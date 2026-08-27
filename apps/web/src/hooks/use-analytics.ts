import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "@/services/analytics";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useAnalytics() {
  const signedQuery = useQuery({
    queryKey: [...queryKeys.analytics, "signed-over-time"],
    queryFn: () => analyticsService.listSignedOverTime(),
  });
  const meanTimeQuery = useQuery({
    queryKey: [...queryKeys.analytics, "mean-time"],
    queryFn: () => analyticsService.listMeanTime(),
  });
  const coverageQuery = useQuery({
    queryKey: [...queryKeys.analytics, "mitre-coverage"],
    queryFn: () => analyticsService.listMitreCoverage(),
  });
  return {
    signedOverTime: signedQuery.data ?? [],
    meanTime: meanTimeQuery.data ?? [],
    mitreCoverage: coverageQuery.data ?? [],
    state: deriveViewState(signedQuery),
  };
}
