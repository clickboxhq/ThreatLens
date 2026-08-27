import { leaderboard } from "@/lib/soc-data";
import type { LeaderboardService } from "./leaderboard-service";

export const mockLeaderboardService: LeaderboardService = {
  listLeaderboard: () => Promise.resolve(leaderboard),
};
