import type { AchievementKey } from "@/types/threatlens-achievements";

// One illustrated emblem per achievement (served from public/badges/). Each image ships on a
// solid black backing; render sites apply `mix-blend-mode: screen` so that black drops to
// nothing against a dark card rather than showing as a mismatched square. Shared by the
// Achievements page and the Profile page's badge strip.
export const ACHIEVEMENT_BADGES: Record<AchievementKey, string> = {
  first_blood: "/badges/first-blood.jpg",
  perfect_score: "/badges/perfect-score.jpg",
  sharpshooter: "/badges/sharpshooter.jpg",
  technique_master: "/badges/technique-master.jpg",
  verdict_veteran: "/badges/verdict-veteran.jpg",
  no_hints_needed: "/badges/no-hints-needed.jpg",
  category_explorer: "/badges/category-explorer.jpg",
};
