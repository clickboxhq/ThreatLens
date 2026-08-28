import type { AchievementDto } from "@/types/socverse-achievements";

export interface AchievementsService {
  listMine(): Promise<AchievementDto[]>;
}
