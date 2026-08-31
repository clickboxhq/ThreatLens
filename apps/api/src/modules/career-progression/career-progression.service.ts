import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CAREER_LEVEL_THRESHOLDS,
  nextEarnedLevel,
  nextLevel,
} from './career-progression-definitions';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { CareerSessionFacts } from './career-progression-definitions';
import type { CareerLevel } from '@prisma/client';

const LEVEL_TITLE: Record<CareerLevel, string> = {
  l1: 'SOC Analyst I',
  l2: 'SOC Analyst II',
  senior: 'Senior SOC Analyst',
};

// SOC Career Progression: real, persisted advancement driven by a user's own scored-session
// history — same post-score trigger point as achievements/certificates (see
// ScoringService.scoreSession), same "re-check everything, only move forward" pattern.
// Split into service-only (this) + *ApiModule exactly like AchievementsModule, since
// ScoringService runs in the worker process (worker.module.ts) and shouldn't pull in
// JwtAuthGuard's REST-only dependencies.
@Injectable()
export class CareerProgressionService {
  private readonly logger = new Logger(CareerProgressionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async factsFor(userId: string): Promise<CareerSessionFacts[]> {
    const sessions = await this.prisma.investigationSession.findMany({
      where: { userId, status: 'scored' },
      include: { score: true, scenario: true },
    });
    return sessions
      .filter((s) => s.score)
      .map((s) => ({
        overallPercent: Number(s.score!.overallPercent),
        hintPenaltyPercent: Number(s.score!.hintPenaltyPercent),
        scenarioCategory: s.scenario.category,
      }));
  }

  // Called from ScoringService right after a session is scored, alongside
  // achievementsService.checkAndIssue and certificatesService.checkAndIssueForScenario.
  async checkAndPromote(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { careerLevel: true },
    });
    if (!user) return;

    const facts = await this.factsFor(userId);
    const promoted = nextEarnedLevel(user.careerLevel, facts);
    if (!promoted) return;

    await this.prisma.user.update({
      where: { id: userId },
      data: { careerLevel: promoted },
    });

    await this.notificationsService.create({
      userId,
      category: 'career_milestone',
      title: `Promoted to ${LEVEL_TITLE[promoted]}`,
      body:
        promoted === 'senior'
          ? 'You now investigate independently — the guided checklist steps back and it’s judgment from here.'
          : `Your investigation history earned you a promotion to ${LEVEL_TITLE[promoted]}.`,
      link: '/app/progress',
    });

    this.logger.log(`User ${userId} promoted to career level ${promoted}.`);
  }

  // My Progress: current level, and exactly what's left for the next one — mirrors
  // AchievementsService.listMine's "definitions + earned state" shape, but for a ladder
  // instead of an unordered set.
  async getStatus(user: AuthenticatedUser) {
    const dbUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { careerLevel: true },
    });
    const facts = await this.factsFor(user.id);
    const upcoming = nextLevel(dbUser.careerLevel);
    const threshold = upcoming
      ? CAREER_LEVEL_THRESHOLDS.find((t) => t.level === upcoming)
      : undefined;

    return {
      currentLevel: dbUser.careerLevel,
      currentTitle: LEVEL_TITLE[dbUser.careerLevel],
      sessionsScored: facts.length,
      nextLevel: threshold
        ? {
            level: threshold.level,
            title: threshold.title,
            requirements: threshold.requirements.map((r) => ({
              label: r.label,
              met: r.met(facts),
            })),
          }
        : null,
    };
  }
}
