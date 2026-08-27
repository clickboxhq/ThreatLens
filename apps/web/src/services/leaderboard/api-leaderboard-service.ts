import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { LeaderboardService } from "./leaderboard-service";

export const apiLeaderboardService: LeaderboardService = {
  listLeaderboard: () => {
    throw new NotConnectedError("LeaderboardService.listLeaderboard");
  },
};
