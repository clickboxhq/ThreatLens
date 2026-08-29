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

function buildService() {
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
    cohort: { findUnique: jest.fn(async () => cohort) },
    attackScenario: { findUnique: jest.fn(async () => scenario) },
    cohortScenarioAssignment: {
      create: jest.fn(async () => ({ id: 'assignment-1' })),
      findUniqueOrThrow: jest.fn(async () => ({
        id: 'assignment-1',
        scenarioId: scenario.id,
        dueAt: null,
        attemptLimit: null,
        createdAt: new Date(),
        scenario,
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

  it('rejects an instructor who does not own the cohort', async () => {
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
            ownerId: 'someone-else',
          },
        },
      },
    });
    const user = buildUser();

    await expect(
      service.submitFeedback(user, 'incident-1', {
        comment: 'x',
      } as never),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
});
