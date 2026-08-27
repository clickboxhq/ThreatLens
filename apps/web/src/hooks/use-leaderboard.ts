import { useQuery } from "@tanstack/react-query";
import { leaderboardService } from "@/services/leaderboard";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useLeaderboard() {
  const query = useQuery({
    queryKey: queryKeys.leaderboard,
    queryFn: () => leaderboardService.listLeaderboard(),
  });
  return { ...query, leaderboard: query.data ?? [], state: deriveViewState(query) };
}
