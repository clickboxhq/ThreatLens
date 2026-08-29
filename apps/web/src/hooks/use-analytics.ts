import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "@/services/analytics";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useAnalytics() {
  const activityQuery = useQuery({
    queryKey: [...queryKeys.analytics, "activity"],
    queryFn: () => analyticsService.listInvestigationActivity(),
  });
  const resolutionQuery = useQuery({
    queryKey: [...queryKeys.analytics, "time-to-resolution"],
    queryFn: () => analyticsService.listTimeToResolution(),
  });
  const coverageQuery = useQuery({
    queryKey: [...queryKeys.analytics, "mitre-coverage"],
    queryFn: () => analyticsService.listMitreCoverage(),
  });
  return {
    activity: activityQuery.data ?? [],
    timeToResolution: resolutionQuery.data ?? [],
    mitreCoverage: coverageQuery.data ?? [],
    state: deriveViewState(activityQuery),
  };
}
