import { useQuery } from "@tanstack/react-query";
import { cohortsService } from "@/services/cohorts";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useCohorts() {
  const cohortsQuery = useQuery({
    queryKey: [...queryKeys.cohorts, "list"],
    queryFn: () => cohortsService.listCohorts(),
  });
  const statsQuery = useQuery({
    queryKey: [...queryKeys.cohorts, "stats"],
    queryFn: () => cohortsService.getStats(),
  });
  const trackCompletionQuery = useQuery({
    queryKey: [...queryKeys.cohorts, "track-completion"],
    queryFn: () => cohortsService.listTrackCompletion(),
  });
  return {
    cohorts: cohortsQuery.data ?? [],
    stats: statsQuery.data,
    trackCompletion: trackCompletionQuery.data ?? [],
    state: deriveViewState(cohortsQuery),
  };
}
