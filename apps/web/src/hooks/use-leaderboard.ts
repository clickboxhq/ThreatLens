import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { leaderboardService } from "@/services/leaderboard";
import type { LeaderboardPeriod } from "@/types/socverse-learning";

export function useLeaderboard() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("all_time");
  const query = useQuery({
    queryKey: ["leaderboard", "global", period],
    queryFn: () => leaderboardService.get(period, "global"),
  });
  return {
    period,
    setPeriod,
    leaderboard: query.data,
    isPending: query.isPending,
    isError: query.isError,
  };
}
