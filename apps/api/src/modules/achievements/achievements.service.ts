import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ACHIEVEMENT_DEFINITIONS } from './achievement-definitions';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { ScoredSessionFacts } from './achievement-definitions';

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Called from ScoringService right after a session is scored — same trigger point and same
  // "re-check everything, not just what just changed" spirit as
  // CertificatesService.checkAndIssueForScenario.
  async checkAndIssue(userId: string): Promise<void> {
    const alreadyEarned = new Set(
      (
        await this.prisma.achievement.findMany({
          where: { userId },
          select: { key: true },
        })
      ).map((a) => a.key),
    );

    const unearnedDefinitions = ACHIEVEMENT_DEFINITIONS.filter(
      (def) => !alreadyEarned.has(def.key),
    );
    if (unearnedDefinitions.length === 0) return;

    const sessions = await this.prisma.investigationSession.findMany({
      where: { userId, status: 'scored' },
      include: { score: true, scenario: true },
    });
    const facts: ScoredSessionFacts[] = sessions
      .filter((s) => s.score)
      .map((s) => ({
        overallPercent: Number(s.score!.overallPercent),
        evidencePrecisionPercent: Number(s.score!.evidencePrecisionPercent),
        techniqueAccuracyPercent: Number(s.score!.techniqueAccuracyPercent),
        verdictCorrect: s.score!.verdictCorrect,
        hintPenaltyPercent: Number(s.score!.hintPenaltyPercent),
        scenarioCategory: s.scenario.category,
      }));

    const newlyEarnedKeys = unearnedDefinitions
      .filter((def) => def.isEarned(facts))
      .map((def) => def.key);
    if (newlyEarnedKeys.length === 0) return;

    // skipDuplicates guards the (userId, key) unique constraint against a race between two
    // scoring jobs for the same user finishing close together — not expected at this
    // platform's scale, but a plain createMany would otherwise 500 on the second one.
    await this.prisma.achievement.createMany({
      data: newlyEarnedKeys.map((key) => ({ userId, key })),
      skipDuplicates: true,
    });
    this.logger.log(
      `User ${userId} earned achievement(s): ${newlyEarnedKeys.join(', ')}`,
    );
  }

  async listMine(user: AuthenticatedUser) {
    const earned = await this.prisma.achievement.findMany({
      where: { userId: user.id },
    });
    const earnedByKey = new Map(earned.map((a) => [a.key, a.earnedAt]));

    return ACHIEVEMENT_DEFINITIONS.map((def) => ({
      key: def.key,
      title: def.title,
      description: def.description,
      earnedAt: earnedByKey.get(def.key) ?? null,
    }));
  }
}
