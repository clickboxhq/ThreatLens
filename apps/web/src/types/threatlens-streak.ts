// Types matching apps/api/src/modules/streaks/streaks.service.ts.

export interface StreakSummary {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  completedToday: boolean;
}
