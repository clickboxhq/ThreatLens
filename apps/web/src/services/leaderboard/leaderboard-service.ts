import type { LeaderboardEntry } from "@/types/leaderboard";

export interface LeaderboardService {
  listLeaderboard(): Promise<LeaderboardEntry[]>;
}
