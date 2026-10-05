import type { StreakService } from "./streak-service";
import { apiStreakService } from "./api-streak-service";

export const streakService: StreakService = apiStreakService;
export type { StreakService } from "./streak-service";
