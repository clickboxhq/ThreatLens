import { Injectable } from '@nestjs/common';
import { toNumber } from '../../common/dto/decimal';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeEventsService } from '../../common/realtime/realtime-events.service';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
import { CohortAccessService } from './cohort-access.service';
import type { CohortStaffRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { AppException } from '../../common/exceptions/app-exception';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type {
  CreateAssignmentDto,
  CreateCohortDto,
  SubmitInstructorFeedbackDto,
} from './dto/instructor.dto';

const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/I/1 — avoids transcription errors

@Injectable()
export class InstructorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeEvents: RealtimeEventsService,
    private readonly auditLog: AuditLogService,
    private readonly cohortAccess: CohortAccessService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createCohort(user: AuthenticatedUser, dto: CreateCohortDto) {
    const cohort = await this.prisma.cohort.create({
      data: {
        ownerId: user.id,
        // Inherited so an org_admin can see what runs under their organisation. Null for an
        // instructor with no org, which is a legitimate individual account.
        orgId: user.orgId,
        // The creator is staffed as lead immediately — owner_id is only a record of who made
        // it, and every permission check reads cohort_staff.
        staff: { create: { userId: user.id, role: 'lead' } },
        name: dto.name,
        joinCode: generateJoinCode(),
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });
    // §6.22: `cohort_created` is one of the doc's own named example actions.
    await this.auditLog.record({
      actorUserId: user.id,
      action: 'cohort_created',
      targetType: 'cohort',
      targetId: cohort.id,
      metadata: { name: dto.name },
    });
    return this.toCohortDto(cohort.id);
  }

  async listCohorts(user: AuthenticatedUser, includeArchived = false) {
    // Everything they are staffed on, plus — for an org_admin — everything in their org.
    const ids = await this.cohortAccess.listAccessibleCohortIds(user);
    const cohorts = await this.prisma.cohort.findMany({
      // Archived cohorts are hidden unless asked for. An instructor still needs to reach last
      // term's grades and feedback, so this is opt-in rather than gone.
      where: {
        id: { in: ids },
        ...(includeArchived ? {} : { archivedAt: null }),
      },
      include: { _count: { select: { enrollments: true, assignments: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return cohorts.map((c) => ({
      id: c.id,
      name: c.name,
      joinCode: c.joinCode,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      archivedAt: c.archivedAt,
      enrollmentCount: c._count.enrollments,
      assignmentCount: c._count.assignments,
      createdAt: c.createdAt,
    }));
  }

  async getRoster(user: AuthenticatedUser, cohortId: string) {
    const access = await this.cohortAccess.requireAccess(cohortId, user);
    const enrollments = await this.prisma.cohortEnrollment.findMany({
      // A group_tutor sees only their own groups' students.
      where: this.cohortAccess.enrollmentScope(access),
      include: { user: true, group: true },
      orderBy: { enrolledAt: 'asc' },
    });
    return enrollments.map((e) => ({
      userId: e.userId,
      displayName: e.user.displayName,
      email: e.user.email,
      status: e.status,
      groupId: e.groupId,
      groupName: e.group?.name ?? null,
      enrolledAt: e.enrolledAt,
    }));
  }

  /**
   * Retires a cohort, or brings it back.
   *
   * Archiving is what "delete" would have been if deleting were safe. It is not: enrolments
   * and assignments reference the cohort, and graded sessions reference those assignments, so
   * removing one would take its students' scored work and certificate evidence with it. A
   * class ending should not erase what happened in it.
   *
   * Reversible on purpose — the usual reason to archive is a typo or a finished term, and
   * both of those get undone.
   */
  async setArchived(
    user: AuthenticatedUser,
    cohortId: string,
    archived: boolean,
  ) {
    // Lead only. Retiring a cohort hides it from everyone teaching and studying on it.
    await this.cohortAccess.requireAccess(cohortId, user, 'lead');

    const cohort = await this.prisma.cohort.update({
      where: { id: cohortId },
      data: { archivedAt: archived ? new Date() : null },
    });

    await this.auditLog.record({
      actorUserId: user.id,
      action: archived ? 'cohort_archived' : 'cohort_restored',
      targetType: 'cohort',
      targetId: cohortId,
    });

    return {
      id: cohort.id,
      name: cohort.name,
      archivedAt: cohort.archivedAt,
    };
  }

  async createAssignment(
    user: AuthenticatedUser,
    cohortId: string,
    dto: CreateAssignmentDto,
  ) {
    const cohort = await this.requireCohort(cohortId, user, 'tutor');
    const scenario = await this.prisma.attackScenario.findUnique({
      where: { id: dto.scenarioId },
    });
    if (!scenario || scenario.status !== 'published') {
      throw new AppException(
        404,
        'SCENARIO_NOT_FOUND',
        'Scenario not found or not published.',
      );
    }
    // A group_tutor may only assign into their own groups, and may not assign cohort-wide.
    const access = await this.cohortAccess.requireAccess(
      cohortId,
      user,
      'tutor',
    );
    this.cohortAccess.assertNotArchived(access);
    if (access.groupScoped) {
      if (!dto.groupId) {
        throw new AppException(
          403,
          'FORBIDDEN',
          'You can only assign work to a group you run, not to the whole cohort.',
        );
      }
      if (!access.groupIds.includes(dto.groupId)) {
        throw new AppException(
          403,
          'FORBIDDEN',
          'You can only assign work to groups you run.',
        );
      }
    }
    if (dto.groupId) {
      const group = await this.prisma.cohortGroup.findFirst({
        where: { id: dto.groupId, cohortId },
      });
      if (!group) throw new AppException(404, 'NOT_FOUND', 'Group not found.');
    }

    const assignment = await this.prisma.cohortScenarioAssignment.create({
      data: {
        cohortId,
        groupId: dto.groupId ?? null,
        scenarioId: dto.scenarioId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        attemptLimit: dto.attemptLimit,
        createdBy: user.id,
      },
    });

    // Notify only the people the assignment applies to — a group-scoped assignment landing in
    // every student's notifications would tell them about work that is not theirs.
    const roster = await this.prisma.cohortEnrollment.findMany({
      where: {
        cohortId,
        status: 'active',
        ...(dto.groupId ? { groupId: dto.groupId } : {}),
      },
      select: { userId: true },
    });
    await Promise.all(
      roster.map((r) =>
        this.notificationsService.create({
          userId: r.userId,
          category: 'assignment',
          title: `New assignment: ${scenario.title}`,
          body: `Assigned to ${cohort.name}${dto.dueAt ? `, due ${new Date(dto.dueAt).toLocaleDateString()}` : ''}.`,
          link: '/app/assessments',
        }),
      ),
    );

    return this.toAssignmentDto(assignment.id);
  }

  async listAssignments(user: AuthenticatedUser, cohortId: string) {
    await this.cohortAccess.requireAccess(cohortId, user);
    const assignments = await this.prisma.cohortScenarioAssignment.findMany({
      where: { cohortId },
      include: { scenario: true, group: true },
      orderBy: { createdAt: 'desc' },
    });
    return assignments.map(mapAssignment);
  }

  async reviewQueue(user: AuthenticatedUser, cohortId: string) {
    await this.cohortAccess.requireAccess(cohortId, user);
    const assignmentIds = (
      await this.prisma.cohortScenarioAssignment.findMany({
        where: { cohortId },
        select: { id: true },
      })
    ).map((a) => a.id);
    if (assignmentIds.length === 0) return [];

    const sessions = await this.prisma.investigationSession.findMany({
      where: {
        cohortAssignmentId: { in: assignmentIds },
        status: { in: ['submitted', 'scored'] },
      },
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
      overallPercent: toNumber(s.score?.overallPercent),
      verdictCorrect: s.score?.verdictCorrect ?? null,
    }));
  }

  async submitFeedback(
    user: AuthenticatedUser,
    incidentId: string,
    dto: SubmitInstructorFeedbackDto,
  ) {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: {
        session: {
          include: { cohortAssignment: { include: { cohort: true } } },
        },
      },
    });
    if (!incident)
      throw new AppException(404, 'NOT_FOUND', 'Incident not found.');

    const cohort = incident.session.cohortAssignment?.cohort;
    if (!cohort) {
      throw new AppException(
        403,
        'FORBIDDEN',
        'You do not have access to this incident.',
      );
    }
    // Any staff member on the cohort may give feedback, not only whoever created it. A
    // group_tutor is additionally limited to students in their own groups.
    //
    // Staff, though — not merely anyone who can see the cohort. Feedback carries rubric
    // overrides, so it changes a grade. Asking for the lowest staff rank by name would also
    // admit an org_admin, whose read access is explicitly not permission to teach.
    const access = await this.cohortAccess.requireAccess(cohort.id, user);
    if (!access.canWrite) {
      throw new AppException(
        403,
        'FORBIDDEN',
        'You can view this cohort but not give feedback on its work.',
      );
    }
    if (access.groupScoped) {
      const enrollment = await this.prisma.cohortEnrollment.findUnique({
        where: {
          cohortId_userId: {
            cohortId: cohort.id,
            userId: incident.session.userId,
          },
        },
        select: { groupId: true },
      });
      if (
        !enrollment?.groupId ||
        !access.groupIds.includes(enrollment.groupId)
      ) {
        throw new AppException(
          403,
          'FORBIDDEN',
          'That student is not in one of your groups.',
        );
      }
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
            this.prisma.incident.update({
              where: { id: incidentId },
              data: { status: 'reopened' },
            }),
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

    const instructor = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    await this.notificationsService.create({
      userId: incident.session.userId,
      category: 'instructor_feedback',
      title: `Feedback from ${instructor.displayName}`,
      body: reopenSession
        ? 'Your investigation was reopened with new feedback — see what to revisit.'
        : 'New feedback on your investigation.',
      link: `/app/cases/${incident.sessionId}`,
    });

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

  async gradebookCsv(
    user: AuthenticatedUser,
    cohortId: string,
  ): Promise<string> {
    const cohort = await this.requireCohort(cohortId, user, 'tutor');
    const assignments = await this.prisma.cohortScenarioAssignment.findMany({
      where: { cohortId },
      include: { scenario: true, group: true },
    });
    const assignmentIds = assignments.map((a) => a.id);
    const scenarioTitleByAssignment = new Map(
      assignments.map((a) => [a.id, a.scenario.title]),
    );

    const sessions = assignmentIds.length
      ? await this.prisma.investigationSession.findMany({
          where: { cohortAssignmentId: { in: assignmentIds } },
          include: { user: true, score: true },
          orderBy: { startedAt: 'asc' },
        })
      : [];

    const header = [
      'Student',
      'Email',
      'Assignment',
      'Status',
      'Overall %',
      'Verdict Correct',
      'Submitted At',
    ];
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

  /**
   * Confirms the caller may act on this cohort at the given authority, and returns it.
   * Replaces the old owner-equality check — a cohort now has many staff, and an org_admin can
   * read one without being staffed on it.
   */
  private async requireCohort(
    cohortId: string,
    user: AuthenticatedUser,
    minRole: CohortStaffRole = 'group_tutor',
  ) {
    await this.cohortAccess.requireAccess(cohortId, user, minRole);
    return this.prisma.cohort.findUniqueOrThrow({ where: { id: cohortId } });
  }

  private async toCohortDto(cohortId: string) {
    const cohort = await this.prisma.cohort.findUniqueOrThrow({
      where: { id: cohortId },
    });
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
    const assignment =
      await this.prisma.cohortScenarioAssignment.findUniqueOrThrow({
        where: { id: assignmentId },
        include: { scenario: true, group: true },
      });
    return mapAssignment(assignment);
  }
}

function mapAssignment(a: {
  id: string;
  scenarioId: string;
  groupId: string | null;
  dueAt: Date | null;
  attemptLimit: number | null;
  createdAt: Date;
  scenario: { title: string };
  group: { name: string } | null;
}) {
  return {
    id: a.id,
    scenarioId: a.scenarioId,
    scenarioTitle: a.scenario.title,
    // Null means the whole cohort. Without these an instructor cannot tell a group-scoped
    // assignment from a cohort-wide one after creating it — the write path knew, the read
    // path forgot.
    groupId: a.groupId,
    groupName: a.group?.name ?? null,
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
