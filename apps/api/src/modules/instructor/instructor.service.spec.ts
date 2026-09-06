import { InstructorService } from './instructor.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

function buildUser(
  overrides: Partial<Record<string, unknown>> = {},
): AuthenticatedUser {
  return {
    id: 'instructor-1',
    role: 'instructor',
    orgId: null,
    ...overrides,
  } as AuthenticatedUser;
}

function buildService(
  accessOverride?: unknown,
  group?: { id: string; name: string },
) {
  const cohort = {
    id: 'cohort-1',
    ownerId: 'instructor-1',
    name: 'Autumn 2026 · Tier 1',
  };
  const scenario = {
    id: 'scenario-1',
    title: 'Password Spraying Campaign',
    status: 'published',
  };
  const instructor = { id: 'instructor-1', displayName: 'Jonas Weber' };

  const prisma = {
    cohort: {
      findUnique: jest.fn(async () => cohort),
      findUniqueOrThrow: jest.fn(async () => cohort),
    },
    attackScenario: { findUnique: jest.fn(async () => scenario) },
    cohortGroup: { findFirst: jest.fn(async () => group ?? null) },
    cohortScenarioAssignment: {
      create: jest.fn(async () => ({ id: 'assignment-1' })),
      findUniqueOrThrow: jest.fn(async () => ({
        id: 'assignment-1',
        scenarioId: scenario.id,
        groupId: group?.id ?? null,
        dueAt: null,
        attemptLimit: null,
        createdAt: new Date(),
        scenario,
        group: group ?? null,
      })),
    },
    cohortEnrollment: {
      findMany: jest.fn(async () => [
        { userId: 'student-1' },
        { userId: 'student-2' },
      ]),
    },
    incident: {
      findUnique: jest.fn(async () => ({
        id: 'incident-1',
        sessionId: 'session-1',
        session: {
          userId: 'student-1',
          cohortAssignment: { cohort },
        },
      })),
      update: jest.fn(async () => undefined),
    },
    instructorFeedback: {
      create: jest.fn(async () => ({ id: 'feedback-1' })),
      findMany: jest.fn(async () => []),
    },
    investigationSession: { update: jest.fn(async () => undefined) },
    user: { findUniqueOrThrow: jest.fn(async () => instructor) },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const realtimeEvents = { publish: jest.fn(async () => undefined) };
  const auditLog = { record: jest.fn(async () => undefined) };
  const notificationsService = { create: jest.fn(async () => undefined) };

  const service = new InstructorService(
    prisma as never,
    realtimeEvents as never,
    auditLog as never,
    (accessOverride ?? {
      requireAccess: jest.fn().mockResolvedValue({
        cohortId: 'c1',
        role: 'lead',
        groupScoped: false,
        groupIds: [],
        canWrite: true,
        canManageStaff: true,
        archived: false,
      }),
      assertNotArchived: jest.fn(),
      enrollmentScope: (a: { cohortId: string }) => ({ cohortId: a.cohortId }),
      listAccessibleCohortIds: jest.fn().mockResolvedValue([]),
    }) as never,
    notificationsService as never,
  );
  return { service, prisma, realtimeEvents, notificationsService };
}

describe('InstructorService.createAssignment', () => {
  it('notifies every actively-enrolled student in the cohort', async () => {
    const { service, notificationsService } = buildService();
    const user = buildUser();

    await service.createAssignment(user, 'cohort-1', {
      scenarioId: 'scenario-1',
    } as never);

    expect(notificationsService.create).toHaveBeenCalledTimes(2);
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'student-1', category: 'assignment' }),
    );
    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'student-2', category: 'assignment' }),
    );
  });

  // The write path took a groupId but the read path dropped it, so a group-scoped assignment
  // came back indistinguishable from a cohort-wide one. Both directions are asserted because
  // only having one of them is what let this through the first time.
  it('reports which group a group-scoped assignment is for', async () => {
    const { service } = buildService(undefined, {
      id: 'group-1',
      name: 'Seminar A',
    });
    const result = await service.createAssignment(buildUser(), 'cohort-1', {
      scenarioId: 'scenario-1',
      groupId: 'group-1',
    } as never);

    expect(result).toMatchObject({
      groupId: 'group-1',
      groupName: 'Seminar A',
    });
  });

  it('reports a cohort-wide assignment as belonging to no group', async () => {
    const { service } = buildService();
    const result = await service.createAssignment(buildUser(), 'cohort-1', {
      scenarioId: 'scenario-1',
    } as never);

    expect(result).toMatchObject({ groupId: null, groupName: null });
  });

  it('only notifies actively-enrolled students, not the whole cohort table', async () => {
    const { service, prisma } = buildService();
    const user = buildUser();

    await service.createAssignment(user, 'cohort-1', {
      scenarioId: 'scenario-1',
    } as never);

    expect(prisma.cohortEnrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cohortId: 'cohort-1', status: 'active' },
      }),
    );
  });
});

describe('InstructorService.submitFeedback', () => {
  // Feedback carries rubric overrides, so it changes a grade. It was previously gated on the
  // lowest staff rank by name, which also admitted anyone holding read-only access to the
  // cohort — an org_admin could have graded work in a cohort they may only look at.
  it('refuses somebody who can only view the cohort', async () => {
    const { service } = buildService({
      requireAccess: jest.fn().mockResolvedValue({
        cohortId: 'c1',
        role: null,
        groupScoped: false,
        groupIds: [],
        canWrite: false,
        canManageStaff: false,
        isPlatformAdmin: false,
      }),
      enrollmentScope: (a: { cohortId: string }) => ({ cohortId: a.cohortId }),
      listAccessibleCohortIds: jest.fn().mockResolvedValue([]),
    });

    await expect(
      service.submitFeedback(buildUser({ role: 'org_admin' }), 'incident-1', {
        comment: 'Nice work.',
      } as never),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('refuses a platform admin, who can repair a cohort but not grade it', async () => {
    const { service } = buildService({
      requireAccess: jest.fn().mockResolvedValue({
        cohortId: 'c1',
        role: null,
        groupScoped: false,
        groupIds: [],
        canWrite: false,
        canManageStaff: true,
        isPlatformAdmin: true,
      }),
      enrollmentScope: (a: { cohortId: string }) => ({ cohortId: a.cohortId }),
      listAccessibleCohortIds: jest.fn().mockResolvedValue([]),
    });

    await expect(
      service.submitFeedback(
        buildUser({ role: 'platform_admin' }),
        'incident-1',
        { comment: 'Nice work.' } as never,
      ),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it("notifies the incident's owning student, not the instructor", async () => {
    const { service, notificationsService } = buildService();
    const user = buildUser();

    await service.submitFeedback(user, 'incident-1', {
      comment: 'Good catch on the technique tagging.',
    } as never);

    expect(notificationsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'student-1',
        category: 'instructor_feedback',
        title: 'Feedback from Jonas Weber',
      }),
    );
  });

  // The rule changed with multi-tutor cohorts: it is no longer "did you create this cohort"
  // but "are you staffed on it". An instructor with no staff row must still be refused, and a
  // co-tutor who never created it must now be allowed — the whole point of the change.
  it('rejects an instructor who is not staffed on the cohort', async () => {
    const { service } = buildService({
      requireAccess: jest.fn().mockRejectedValue(
        Object.assign(new Error('Cohort not found.'), {
          status: 404,
          code: 'NOT_FOUND',
        }),
      ),
    });

    await expect(
      service.submitFeedback(buildUser(), 'incident-1', {
        comment: 'x',
      } as never),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('allows a co-tutor who did not create the cohort', async () => {
    const { service, prisma } = buildService();
    prisma.incident.findUnique.mockResolvedValueOnce({
      id: 'incident-1',
      sessionId: 'session-1',
      session: {
        userId: 'student-1',
        cohortAssignment: {
          cohort: {
            id: 'cohort-1',
            name: 'Autumn 2026 · Tier 1',
            // Created by somebody else entirely; the caller is staffed as a tutor.
            ownerId: 'someone-else',
          },
        },
      },
    });

    await expect(
      service.submitFeedback(buildUser(), 'incident-1', {
        comment: 'Solid write-up, but the containment call needed justifying.',
      } as never),
    ).resolves.toBeDefined();
  });
});
