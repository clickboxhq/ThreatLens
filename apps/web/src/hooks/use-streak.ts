import { useQuery } from "@tanstack/react-query";
import { streakService } from "@/services/streak";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useStreak() {
  const query = useQuery({
    queryKey: queryKeys.streak,
    queryFn: () => streakService.getMine(),
  });
  return { ...query, streak: query.data ?? null, state: deriveViewState(query) };
}
