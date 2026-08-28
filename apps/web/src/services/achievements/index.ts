import type { AchievementsService } from "./achievements-service";
import { apiAchievementsService } from "./api-achievements-service";

export const achievementsService: AchievementsService = apiAchievementsService;
export type { AchievementsService } from "./achievements-service";
