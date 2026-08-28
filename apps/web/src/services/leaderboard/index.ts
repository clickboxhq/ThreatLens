import { apiLeaderboardService } from "./api-leaderboard-service";
import type { LeaderboardService } from "./leaderboard-service";

export const leaderboardService: LeaderboardService = apiLeaderboardService;

export type { LeaderboardService } from "./leaderboard-service";
