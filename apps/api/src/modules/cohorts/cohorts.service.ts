import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app-exception';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

// Student-facing side of Instructor Mode (§2.15): joining a cohort by code and seeing
// what's been assigned. Instructor-side management lives in the `instructor` module,
// gated by RolesGuard — this module is reachable by any authenticated Student.
@Injectable()
export class CohortsService {
  constructor(private readonly prisma: PrismaService) {}

  async join(user: AuthenticatedUser, joinCode: string) {
    const cohort = await this.prisma.cohort.findUnique({ where: { joinCode } });
    if (!cohort) {
      throw new AppException(
        404,
        'INVALID_JOIN_CODE',
        'No cohort matches this join code.',
      );
    }

    const enrollment = await this.prisma.cohortEnrollment.upsert({
      where: { cohortId_userId: { cohortId: cohort.id, userId: user.id } },
      update: { status: 'active' },
      create: { cohortId: cohort.id, userId: user.id, status: 'active' },
    });

    return {
      cohortId: cohort.id,
      cohortName: cohort.name,
      enrolledAt: enrollment.enrolledAt,
    };
  }

  async listMine(user: AuthenticatedUser) {
    const enrollments = await this.prisma.cohortEnrollment.findMany({
      where: { userId: user.id, status: 'active' },
      include: { cohort: true },
      orderBy: { enrolledAt: 'desc' },
    });
    return enrollments.map((e) => ({
      id: e.cohort.id,
      name: e.cohort.name,
      enrolledAt: e.enrolledAt,
    }));
  }

  async listMyAssignments(user: AuthenticatedUser) {
    const enrollments = await this.prisma.cohortEnrollment.findMany({
      where: { userId: user.id, status: 'active' },
      select: { cohortId: true, groupId: true },
    });
    const cohortIds = enrollments.map((e) => e.cohortId);

    if (cohortIds.length === 0) return [];

    // Their own groups, across every cohort they are in. A group belongs to exactly one
    // cohort, so these cannot collide between cohorts.
    const myGroupIds = enrollments
      .map((e) => e.groupId)
      .filter((g): g is string => g !== null);

    const assignments = await this.prisma.cohortScenarioAssignment.findMany({
      where: {
        cohortId: { in: cohortIds },
        // Cohort-wide work, plus work set for a group this student is actually in. Without
        // this a student would see — and could launch — assignments meant for another group.
        OR: [{ groupId: null }, { groupId: { in: myGroupIds } }],
      },
      include: { scenario: true, cohort: true },
      orderBy: { createdAt: 'desc' },
    });

    const attemptCounts = await this.prisma.investigationSession.groupBy({
      by: ['cohortAssignmentId'],
      where: {
        cohortAssignmentId: { in: assignments.map((a) => a.id) },
        userId: user.id,
      },
      _count: { _all: true },
    });
    const attemptsByAssignment = new Map(
      attemptCounts.map((c) => [c.cohortAssignmentId, c._count._all]),
    );

    return assignments.map((a) => ({
      id: a.id,
      cohortName: a.cohort.name,
      scenarioId: a.scenarioId,
      scenarioTitle: a.scenario.title,
      dueAt: a.dueAt,
      attemptLimit: a.attemptLimit,
      attemptsUsed: attemptsByAssignment.get(a.id) ?? 0,
    }));
  }
}
