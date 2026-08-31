import type { AchievementDto } from "@/types/threatlens-achievements";

export interface AchievementsService {
  listMine(): Promise<AchievementDto[]>;
}
