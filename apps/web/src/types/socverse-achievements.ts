// Types matching SOCVerse's real achievements API (apps/api/src/modules/achievements) — net new
// in Phase 6 of the merge plan. Definitions are fixed server-side (apps/api's
// achievement-definitions.ts is the single source of truth for what each one means and when it's
// earned); the client only ever renders what GET /achievements/mine returns.

export type AchievementKey =
  | "first_blood"
  | "perfect_score"
  | "sharpshooter"
  | "technique_master"
  | "verdict_veteran"
  | "no_hints_needed"
  | "category_explorer";

export interface AchievementDto {
  key: AchievementKey;
  title: string;
  description: string;
  /** ISO timestamp, or null if not yet earned. */
  earnedAt: string | null;
}
