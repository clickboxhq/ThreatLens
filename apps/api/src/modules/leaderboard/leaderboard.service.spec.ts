import { LeaderboardService } from './leaderboard.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

const VIEWER = {
  id: 'viewer-1',
  orgId: null,
  email: 'viewer@example.com',
  role: 'student',
  sessionVersion: 1,
} as unknown as AuthenticatedUser;

function session(userId: string, displayName: string, percent: number) {
  return {
    userId,
    user: { displayName },
    score: { overallPercent: percent },
    scenario: { difficulty: 'intermediate' },
  };
}

function buildService(sessions: unknown[]) {
  const prisma = {
    investigationSession: { findMany: jest.fn().mockResolvedValue(sessions) },
    cohort: { findUnique: jest.fn() },
    cohortEnrollment: { findUnique: jest.fn() },
  } as unknown as PrismaService;
  return new LeaderboardService(prisma);
}

describe('LeaderboardService — cross-tenant disclosure', () => {
  const SESSIONS = [
    session('viewer-1', 'Viewer Themselves', 90),
    session('other-1', 'Someone At Another Company', 95),
    session('other-2', 'Another Stranger', 80),
  ];

  // The global board spans every organisation on the platform. Before this, it returned every
  // learner's real display name to every other learner, so an individual signing up saw people
  // from unrelated companies by name.
  it('never returns another learner display name on the global board', async () => {
    const result = await buildService(SESSIONS).get(
      VIEWER,
      'all_time',
      'global',
    );

    const others = result.entries.filter((e) => e.userId !== VIEWER.id);
    expect(others.length).toBeGreaterThan(0);
    for (const entry of others) {
      expect(entry.displayName).toBeNull();
    }
  });

  it('never returns another learner user id either', async () => {
    // A stable id is still an identifier — stripping only the name would let a client
    // correlate the same person across boards and periods.
    const result = await buildService(SESSIONS).get(
      VIEWER,
      'all_time',
      'global',
    );
    for (const entry of result.entries.filter((e) => e.displayName === null)) {
      expect(entry.userId).toBeNull();
    }
  });

  it('still shows the viewer their own row, so they can find themselves', async () => {
    const result = await buildService(SESSIONS).get(
      VIEWER,
      'all_time',
      'global',
    );

    const mine = result.entries.find((e) => e.userId === VIEWER.id);
    expect(mine?.displayName).toBe('Viewer Themselves');
    expect(result.myEntry?.displayName).toBe('Viewer Themselves');
  });

  it('keeps ranking and scores intact — anonymity should not cost the motivation', async () => {
    const result = await buildService(SESSIONS).get(
      VIEWER,
      'all_time',
      'global',
    );

    expect(result.entries.map((e) => e.rank)).toEqual([1, 2, 3]);
    // Highest scorer still ranks first even though they are anonymous.
    expect(result.entries[0].points).toBeGreaterThan(result.entries[2].points);
  });

  it('flags the response as anonymised so a client can label it honestly', async () => {
    const result = await buildService(SESSIONS).get(
      VIEWER,
      'all_time',
      'global',
    );
    expect(result.anonymised).toBe(true);
  });

  it('keeps names inside a cohort, where members already know each other', async () => {
    const prisma = {
      investigationSession: { findMany: jest.fn().mockResolvedValue(SESSIONS) },
      cohort: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'c1', ownerId: 'someone' }),
      },
      cohortEnrollment: {
        findUnique: jest.fn().mockResolvedValue({ status: 'active' }),
      },
    } as unknown as PrismaService;

    const result = await new LeaderboardService(prisma).get(
      VIEWER,
      'all_time',
      'cohort',
      'c1',
    );

    expect(result.anonymised).toBe(false);
    expect(
      result.entries.some((e) => e.displayName === 'Another Stranger'),
    ).toBe(true);
  });
});
