import { apiClient } from "@/lib/api-client";
import type { LeaderboardService } from "./leaderboard-service";
import type { LeaderboardDto } from "@/types/threatlens-learning";

export const apiLeaderboardService: LeaderboardService = {
  get: (period, scope, cohortId) => {
    const params = new URLSearchParams({ period, scope });
    if (cohortId) params.set("cohortId", cohortId);
    return apiClient.get<LeaderboardDto>(`/leaderboard?${params.toString()}`);
  },
};
