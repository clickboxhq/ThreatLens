import { useQuery } from "@tanstack/react-query";
import { achievementsService } from "@/services/achievements";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useAchievements() {
  const query = useQuery({
    queryKey: queryKeys.achievements,
    queryFn: () => achievementsService.listMine(),
  });
  return { ...query, achievements: query.data ?? [], state: deriveViewState(query) };
}
