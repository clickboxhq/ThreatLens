import { apiClient } from "@/lib/api-client";
import type { AchievementsService } from "./achievements-service";
import type { AchievementDto } from "@/types/socverse-achievements";

export const apiAchievementsService: AchievementsService = {
  listMine: () => apiClient.get<AchievementDto[]>("/achievements/mine"),
};
