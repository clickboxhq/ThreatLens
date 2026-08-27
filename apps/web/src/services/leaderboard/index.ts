import type { LeaderboardService } from "./leaderboard-service";
import { mockLeaderboardService } from "./mock-leaderboard-service";

export const leaderboardService: LeaderboardService = mockLeaderboardService;
export type { LeaderboardService } from "./leaderboard-service";
