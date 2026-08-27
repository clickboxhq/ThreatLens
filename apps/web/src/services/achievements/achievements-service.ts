import type { Achievement } from "@/types/achievements";

export interface AchievementsService {
  listAchievements(): Promise<Achievement[]>;
}
