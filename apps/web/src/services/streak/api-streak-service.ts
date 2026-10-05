import { apiClient } from "@/lib/api-client";
import type { StreakService } from "./streak-service";
import type { StreakSummary } from "@/types/threatlens-streak";

export const apiStreakService: StreakService = {
  getMine: () => apiClient.get<StreakSummary>("/streak/mine"),
};
