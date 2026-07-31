import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeEventsService } from '../../common/realtime/realtime-events.service';
import { AppException } from '../../common/exceptions/app-exception';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { CreateAssignmentDto, CreateCohortDto, SubmitInstructorFeedbackDto } from './dto/instructor.dto';

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 — avoids transcription errors

@Injectable()
export class InstructorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeEvents: RealtimeEventsService,
  ) {}

  async createCohort(user: AuthenticatedUser, dto: CreateCohortDto) {
    const cohort = await this.prisma.cohort.create({
      data: {
        ownerId: user.id,
        name: dto.name,
        joinCode: generateJoinCode(),
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });
    return this.toCohortDto(cohort.id);
  }

  async listCohorts(user: AuthenticatedUser) {
    const cohorts = await this.prisma.cohort.findMany({
      where: { ownerId: user.id },
      include: { _count: { select: { enrollments: true, assignments: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return cohorts.map((c) => ({
      id: c.id,
      name: c.name,
      joinCode: c.joinCode,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      enrollmentCount: c._count.enrollments,
      assignmentCount: c._count.assignments,
      createdAt: c.createdAt,
    }));
  }

  async getRoster(user: AuthenticatedUser, cohortId: string) {
    await this.getOwnedCohort(cohortId, user);
    const enrollments = await this.prisma.cohortEnrollment.findMany({
      where: { cohortId },
      include: { user: true },
      orderBy: { enrolledAt: 'asc' },
    });
    return enrollments.map((e) => ({
      userId: e.userId,
      displayName: e.user.displayName,
      email: e.user.email,
      status: e.status,
      enrolledAt: e.enrolledAt,
    }));
  }

  async createAssignment(user: AuthenticatedUser, cohortId: string, dto: CreateAssignmentDto) {
    await this.getOwnedCohort(cohortId, user);
    const scenario = await this.prisma.attackScenario.findUnique({ where: { id: dto.scenarioId } });
    if (!scenario || scenario.status !== 'published') {
      throw new AppException(404, 'SCENARIO_NOT_FOUND', 'Scenario not found or not published.');
    }
    const assignment = await this.prisma.cohortScenarioAssignment.create({
      data: {
        cohortId,
        scenarioId: dto.scenarioId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        attemptLimit: dto.attemptLimit,
        createdBy: user.id,
      },
    });
    return this.toAssignmentDto(assignment.id);
  }

  async listAssignments(user: AuthenticatedUser, cohortId: string) {
    await this.getOwnedCohort(cohortId, user);
    const assignments = await this.prisma.cohortScenarioAssignment.findMany({
      where: { cohortId },
      include: { scenario: true },
      orderBy: { createdAt: 'desc' },
    });
    return assignments.map(mapAssignment);
  }

  async reviewQueue(user: AuthenticatedUser, cohortId: string) {
    await this.getOwnedCohort(cohortId, user);
    const assignmentIds = (
      await this.prisma.cohortScenarioAssignment.findMany({ where: { cohortId }, select: { id: true } })
    ).map((a) => a.id);
    if (assignmentIds.length === 0) return [];

    const sessions = await this.prisma.investigationSession.findMany({
      where: { cohortAssignmentId: { in: assignmentIds }, status: { in: ['submitted', 'scored'] } },
      include: { user: true, scenario: true, score: true },
      orderBy: { submittedAt: 'desc' },
    });

    return sessions.map((s) => ({
      sessionId: s.id,
      studentDisplayName: s.user.displayName,
      studentEmail: s.user.email,
      scenarioTitle: s.scenario.title,
      status: s.status,
      submittedAt: s.submittedAt,
      overallPercent: s.score?.overallPercent ?? null,
      verdictCorrect: s.score?.verdictCorrect ?? null,
    }));
  }

  async submitFeedback(user: AuthenticatedUser, incidentId: string, dto: SubmitInstructorFeedbackDto) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: { session: { include: { cohortAssignment: { include: { cohort: true } } } } },
    });
    if (!incident) throw new AppException(404, 'NOT_FOUND', 'Incident not found.');

    const cohort = incident.session.cohortAssignment?.cohort;
    if (!cohort || cohort.ownerId !== user.id) {
      throw new AppException(403, 'FORBIDDEN', 'You do not have access to this incident.');
    }

    const reopenSession = dto.reopenSession ?? false;

    await this.prisma.$transaction([
      this.prisma.instructorFeedback.create({
        data: {
          incidentId,
          instructorId: user.id,
          rubricOverrides: dto.rubricOverrides as unknown as object | undefined,
          comment: dto.comment,
          reopenedSession: reopenSession,
        },
      }),
      ...(reopenSession
        ? [
            this.prisma.incident.update({ where: { id: incidentId }, data: { status: 'reopened' } }),
            this.prisma.investigationSession.update({
              where: { id: incident.sessionId },
              data: { status: 'active' },
            }),
          ]
        : []),
    ]);

    if (reopenSession) {
      // §16.16: the whole point of pushing this one — an instructor reopening an incident
      // while the Student might be sitting on that exact page is the concrete scenario this
      // feature exists for, not a hypothetical (§2.15's reopen action, §5.10).
      await this.realtimeEvents.publish(incident.sessionId, {
        type: 'incident.status_changed',
        payload: { id: incidentId, status: 'reopened' },
      });
    }

    return this.listFeedback(incidentId);
  }

  async listFeedback(incidentId: string) {
    const feedback = await this.prisma.instructorFeedback.findMany({
      where: { incidentId },
      include: { instructor: true },
      orderBy: { createdAt: 'asc' },
    });
    return feedback.map((f) => ({
      id: f.id,
      instructorDisplayName: f.instructor.displayName,
      rubricOverrides: f.rubricOverrides,
      comment: f.comment,
      reopenedSession: f.reopenedSession,
      createdAt: f.createdAt,
    }));
  }

  async gradebookCsv(user: AuthenticatedUser, cohortId: string): Promise<string> {
    const cohort = await this.getOwnedCohort(cohortId, user);
    const assignments = await this.prisma.cohortScenarioAssignment.findMany({
      where: { cohortId },
      include: { scenario: true },
    });
    const assignmentIds = assignments.map((a) => a.id);
    const scenarioTitleByAssignment = new Map(assignments.map((a) => [a.id, a.scenario.title]));

    const sessions = assignmentIds.length
      ? await this.prisma.investigationSession.findMany({
          where: { cohortAssignmentId: { in: assignmentIds } },
          include: { user: true, score: true },
          orderBy: { startedAt: 'asc' },
        })
      : [];

    const header = ['Student', 'Email', 'Assignment', 'Status', 'Overall %', 'Verdict Correct', 'Submitted At'];
    const rows = sessions.map((s) => [
      s.user.displayName,
      s.user.email,
      scenarioTitleByAssignment.get(s.cohortAssignmentId!) ?? '',
      s.status,
      s.score ? s.score.overallPercent.toString() : '',
      s.score ? String(s.score.verdictCorrect) : '',
      s.submittedAt ? s.submittedAt.toISOString() : '',
    ]);

    const lines = [header, ...rows].map((row) => row.map(csvEscape).join(','));
    void cohort;
    return lines.join('\n');
  }

  private async getOwnedCohort(cohortId: string, user: AuthenticatedUser) {
    const cohort = await this.prisma.cohort.findUnique({ where: { id: cohortId } });
    if (!cohort) throw new AppException(404, 'NOT_FOUND', 'Cohort not found.');
    if (cohort.ownerId !== user.id) throw new AppException(403, 'FORBIDDEN', 'You do not own this cohort.');
    return cohort;
  }

  private async toCohortDto(cohortId: string) {
    const cohort = await this.prisma.cohort.findUniqueOrThrow({ where: { id: cohortId } });
    return {
      id: cohort.id,
      name: cohort.name,
      joinCode: cohort.joinCode,
      startsAt: cohort.startsAt,
      endsAt: cohort.endsAt,
      createdAt: cohort.createdAt,
    };
  }

  private async toAssignmentDto(assignmentId: string) {
    const assignment = await this.prisma.cohortScenarioAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: { scenario: true },
    });
    return mapAssignment(assignment);
  }
}

function mapAssignment(a: {
  id: string;
  scenarioId: string;
  dueAt: Date | null;
  attemptLimit: number | null;
  createdAt: Date;
  scenario: { title: string };
}) {
  return {
    id: a.id,
    scenarioId: a.scenarioId,
    scenarioTitle: a.scenario.title,
    dueAt: a.dueAt,
    attemptLimit: a.attemptLimit,
    createdAt: a.createdAt,
  };
}

function generateJoinCode(): string {
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += JOIN_CODE_ALPHABET[bytes[i] % JOIN_CODE_ALPHABET.length];
  }
  return code;
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
