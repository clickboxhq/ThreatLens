import { randomUUID } from 'crypto';
import { AchievementsService } from './achievements.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

function buildUser(
  overrides: Partial<Record<string, unknown>> = {},
): AuthenticatedUser {
  return {
    id: randomUUID(),
    role: 'student',
    orgId: null,
    ...overrides,
  } as AuthenticatedUser;
}

function scoredSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    score: {
      overallPercent: 60,
      evidencePrecisionPercent: 60,
      techniqueAccuracyPercent: 60,
      verdictCorrect: false,
      hintPenaltyPercent: 10,
    },
    scenario: { category: 'identity' },
    ...overrides,
  };
}

function buildService(
  options: {
    alreadyEarnedKeys?: string[];
    sessions?: ReturnType<typeof scoredSession>[];
  } = {},
) {
  const prisma = {
    achievement: {
      findMany: jest.fn(async () =>
        (options.alreadyEarnedKeys ?? []).map((key) => ({ key })),
      ),
      createMany: jest.fn(async () => ({ count: 0 })),
    },
    investigationSession: {
      findMany: jest.fn(async () => options.sessions ?? []),
    },
  };

  const service = new AchievementsService(prisma as never);
  return { service, prisma };
}

describe('AchievementsService.checkAndIssue', () => {
  it('does nothing when every achievement is already earned', async () => {
    const allKeys = [
      'first_blood',
      'perfect_score',
      'sharpshooter',
      'technique_master',
      'verdict_veteran',
      'no_hints_needed',
      'category_explorer',
    ];
    const { service, prisma } = buildService({ alreadyEarnedKeys: allKeys });

    await service.checkAndIssue('user-1');

    expect(prisma.investigationSession.findMany).not.toHaveBeenCalled();
    expect(prisma.achievement.createMany).not.toHaveBeenCalled();
  });

  it('awards first_blood as soon as one scored session exists', async () => {
    const { service, prisma } = buildService({
      sessions: [scoredSession()],
    });

    await service.checkAndIssue('user-1');

    expect(prisma.achievement.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          { userId: 'user-1', key: 'first_blood' },
        ]),
      }),
    );
  });

  it('ignores unscored sessions when evaluating facts', async () => {
    const { service, prisma } = buildService({
      sessions: [{ score: null, scenario: { category: 'identity' } }],
    });

    await service.checkAndIssue('user-1');

    // No scored sessions means first_blood's `sessions.length >= 1` sees an
    // empty facts array and should not fire.
    expect(prisma.achievement.createMany).not.toHaveBeenCalled();
  });

  it('awards perfect_score only when a session hits 100% overall', async () => {
    const { service, prisma } = buildService({
      alreadyEarnedKeys: ['first_blood'],
      sessions: [
        scoredSession({
          score: {
            overallPercent: 99,
            evidencePrecisionPercent: 60,
            techniqueAccuracyPercent: 60,
            verdictCorrect: false,
            hintPenaltyPercent: 10,
          },
        }),
      ],
    });

    await service.checkAndIssue('user-1');
    expect(prisma.achievement.createMany).not.toHaveBeenCalled();

    const { service: service2, prisma: prisma2 } = buildService({
      alreadyEarnedKeys: ['first_blood'],
      sessions: [
        scoredSession({
          score: {
            overallPercent: 100,
            evidencePrecisionPercent: 60,
            techniqueAccuracyPercent: 60,
            verdictCorrect: false,
            hintPenaltyPercent: 10,
          },
        }),
      ],
    });

    await service2.checkAndIssue('user-1');
    expect(prisma2.achievement.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          { userId: 'user-1', key: 'perfect_score' },
        ]),
      }),
    );
  });

  it('awards verdict_veteran only once 5 sessions have a correct verdict', async () => {
    const fourCorrect = Array.from({ length: 4 }, () =>
      scoredSession({
        score: {
          overallPercent: 60,
          evidencePrecisionPercent: 60,
          techniqueAccuracyPercent: 60,
          verdictCorrect: true,
          hintPenaltyPercent: 10,
        },
      }),
    );
    const { service, prisma } = buildService({
      alreadyEarnedKeys: ['first_blood'],
      sessions: fourCorrect,
    });
    await service.checkAndIssue('user-1');
    expect(prisma.achievement.createMany).not.toHaveBeenCalled();

    const fiveCorrect = Array.from({ length: 5 }, () =>
      scoredSession({
        score: {
          overallPercent: 60,
          evidencePrecisionPercent: 60,
          techniqueAccuracyPercent: 60,
          verdictCorrect: true,
          hintPenaltyPercent: 10,
        },
      }),
    );
    const { service: service2, prisma: prisma2 } = buildService({
      alreadyEarnedKeys: ['first_blood'],
      sessions: fiveCorrect,
    });
    await service2.checkAndIssue('user-1');
    expect(prisma2.achievement.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          { userId: 'user-1', key: 'verdict_veteran' },
        ]),
      }),
    );
  });

  it('awards category_explorer only once every category is covered', async () => {
    const categories = [
      'identity',
      'endpoint',
      'email',
      'cloud',
      'insider_threat',
      'web',
      'malware',
    ];
    const { service, prisma } = buildService({
      alreadyEarnedKeys: ['first_blood'],
      sessions: categories.map((category) =>
        scoredSession({ scenario: { category } }),
      ),
    });
    await service.checkAndIssue('user-1');
    expect(prisma.achievement.createMany).not.toHaveBeenCalled();

    const { service: service2, prisma: prisma2 } = buildService({
      alreadyEarnedKeys: ['first_blood'],
      sessions: [...categories, 'ransomware'].map((category) =>
        scoredSession({ scenario: { category } }),
      ),
    });
    await service2.checkAndIssue('user-1');
    expect(prisma2.achievement.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          { userId: 'user-1', key: 'category_explorer' },
        ]),
      }),
    );
  });
});

describe('AchievementsService.listMine', () => {
  it('returns all definitions, marking earned ones with their earnedAt date', async () => {
    const earnedAt = new Date('2026-01-01T00:00:00Z');
    const prisma = {
      achievement: {
        findMany: jest.fn(async () => [{ key: 'first_blood', earnedAt }]),
      },
    };
    const service = new AchievementsService(prisma as never);

    const result = await service.listMine(buildUser());

    expect(result).toHaveLength(7);
    const firstBlood = result.find((a) => a.key === 'first_blood');
    expect(firstBlood?.earnedAt).toEqual(earnedAt);
    const perfectScore = result.find((a) => a.key === 'perfect_score');
    expect(perfectScore?.earnedAt).toBeNull();
  });
});
