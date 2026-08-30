import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app-exception';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

type Period = 'weekly' | 'monthly' | 'all_time';
type Scope = 'global' | 'cohort';

// §13.5: rewards tackling harder content, not farming easy scenarios, at the same score.
const DIFFICULTY_MULTIPLIER: Record<string, number> = {
  beginner: 1,
  intermediate: 1.5,
  advanced: 2,
  expert: 3,
};

interface Accumulator {
  displayName: string;
  points: number;
  completions: number;
  totalPercent: number;
}

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  // Computed live from `scores`/`investigation_sessions` rather than a precomputed
  // `leaderboard_entries` table refreshed by a scheduled rollup job (§5.12) — at this
  // platform's scale a live aggregate is fast enough, and it avoids standing up a new
  // queue/cron/table for a number a handful of concurrent users are reading.
  async get(
    user: AuthenticatedUser,
    period: Period,
    scope: Scope,
    cohortId?: string,
  ) {
    if (scope === 'cohort') {
      if (!cohortId) {
        throw new AppException(
          400,
          'COHORT_ID_REQUIRED',
          'cohortId is required when scope=cohort.',
        );
      }
      await this.assertCohortAccess(cohortId, user);
    }

    const since = periodStart(period);

    const sessions = await this.prisma.investigationSession.findMany({
      where: {
        status: 'scored',
        ...(since ? { submittedAt: { gte: since } } : {}),
        ...(scope === 'cohort' ? { cohortAssignment: { cohortId } } : {}),
      },
      include: { score: true, scenario: true, user: true },
    });

    const byUser = new Map<string, Accumulator>();
    for (const session of sessions) {
      if (!session.score) continue;
      const multiplier =
        DIFFICULTY_MULTIPLIER[session.scenario.difficulty] ?? 1;
      const percent = Number(session.score.overallPercent);
      const entry = byUser.get(session.userId) ?? {
        displayName: session.user.displayName,
        points: 0,
        completions: 0,
        totalPercent: 0,
      };
      entry.points += percent * multiplier;
      entry.completions += 1;
      entry.totalPercent += percent;
      byUser.set(session.userId, entry);
    }

    const ranked = [...byUser.entries()]
      .map(([userId, e]) => ({
        userId,
        displayName: e.displayName,
        points: Math.round(e.points),
        completions: e.completions,
        averagePercent:
          Math.round((e.totalPercent / e.completions) * 100) / 100,
      }))
      .sort((a, b) => b.points - a.points)
      .map((e, i) => ({ ...e, rank: i + 1 }));

    const myEntry = ranked.find((e) => e.userId === user.id) ?? null;

    // Global scope spans every organisation on the platform, so it must not disclose who
    // anyone else is. A learner at one company has no business seeing the names — or the user
    // ids — of learners at another, and stripping them in the UI would be theatre while the
    // API still served them. Rank and score carry the motivation without the disclosure.
    //
    // Cohort scope is different: those people share a classroom and are already visible to one
    // another, and assertCohortAccess has confirmed the caller belongs there.
    const anonymised = scope === 'global';
    const top = ranked
      .slice(0, 50)
      .map((entry) =>
        anonymised && entry.userId !== user.id
          ? { ...entry, userId: null, displayName: null }
          : entry,
      );

    // The caller's own row is their own data, so it keeps its identity in both scopes —
    // that is what lets them find themselves in an otherwise anonymous list.
    return { period, scope, anonymised, entries: top, myEntry };
  }

  private async assertCohortAccess(
    cohortId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const cohort = await this.prisma.cohort.findUnique({
      where: { id: cohortId },
    });
    if (!cohort) throw new AppException(404, 'NOT_FOUND', 'Cohort not found.');
    if (cohort.ownerId === user.id) return;

    const enrollment = await this.prisma.cohortEnrollment.findUnique({
      where: { cohortId_userId: { cohortId, userId: user.id } },
    });
    if (!enrollment || enrollment.status !== 'active') {
      throw new AppException(
        403,
        'FORBIDDEN',
        'You do not have access to this cohort leaderboard.',
      );
    }
  }
}

function periodStart(period: Period): Date | null {
  const now = Date.now();
  if (period === 'weekly') return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (period === 'monthly') return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return null;
}
