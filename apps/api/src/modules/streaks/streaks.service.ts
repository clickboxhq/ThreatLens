import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The caller's calendar day (optionally offset) as a UTC-midnight Date — matches how a
 * `@db.Date` column stores it, so two calls always compare equal regardless of the time of
 * day either one runs. `en-CA` is the one built-in Intl locale that formats as YYYY-MM-DD. */
function calendarDate(timezone: string | null, offsetDays = 0): Date {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(
    new Date(`${formatted}T00:00:00.000Z`).getTime() + offsetDays * DAY_MS,
  );
}

export interface StreakSummary {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  completedToday: boolean;
}

@Injectable()
export class StreaksService {
  private readonly logger = new Logger(StreaksService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called once, as the last statement of SessionsService.submitSession — submission is the
   * qualifying activity, not session creation: submitting already requires every incident
   * closed with a verdict, so it can't be gamed by spamming starts the way an empty
   * createSession could be. Must never fail or roll back the caller's real submission, so
   * every error here is caught and only logged, never rethrown.
   */
  async recordQualifyingActivity(userId: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      });
      const today = calendarDate(user?.timezone ?? null);

      // The unique(userId, activityDate) index is what makes this idempotent: a second
      // submission on the same day hits a conflict and stops here — no second increment, no
      // history scan needed to know "did they already log in today."
      try {
        await this.prisma.streakActivity.create({
          data: { userId, activityDate: today },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          return;
        }
        throw err;
      }

      const yesterday = calendarDate(user?.timezone ?? null, -1);
      const existing = await this.prisma.userStreak.findUnique({
        where: { userId },
      });
      const continuing =
        existing?.lastActivityDate?.getTime() === yesterday.getTime();
      const currentStreak = continuing ? (existing?.currentStreak ?? 0) + 1 : 1;
      const longestStreak = Math.max(
        existing?.longestStreak ?? 0,
        currentStreak,
      );

      await this.prisma.userStreak.upsert({
        where: { userId },
        create: {
          userId,
          currentStreak,
          longestStreak,
          lastActivityDate: today,
        },
        update: { currentStreak, longestStreak, lastActivityDate: today },
      });
    } catch (err) {
      this.logger.error(
        `Failed to record streak activity for user ${userId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async getMine(userId: string): Promise<StreakSummary> {
    const [user, streak] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      }),
      this.prisma.userStreak.findUnique({ where: { userId } }),
    ]);
    const today = calendarDate(user?.timezone ?? null);
    const completedToday =
      streak?.lastActivityDate?.getTime() === today.getTime();

    return {
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      lastActivityDate:
        streak?.lastActivityDate?.toISOString().slice(0, 10) ?? null,
      completedToday,
    };
  }
}
