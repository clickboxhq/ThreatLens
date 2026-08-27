import { useQuery } from "@tanstack/react-query";
import { settingsService } from "@/services/settings";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useSettings() {
  const sectionsQuery = useQuery({
    queryKey: [...queryKeys.settings, "sections"],
    queryFn: () => settingsService.listSections(),
  });
  const togglesQuery = useQuery({
    queryKey: [...queryKeys.settings, "toggles"],
    queryFn: () => settingsService.listSecurityToggles(),
  });
  const regionsQuery = useQuery({
    queryKey: [...queryKeys.settings, "regions"],
    queryFn: () => settingsService.listDataResidencyRegions(),
  });
  return {
    sections: sectionsQuery.data ?? [],
    securityToggles: togglesQuery.data ?? [],
    dataResidencyRegions: regionsQuery.data ?? [],
    state: deriveViewState(sectionsQuery),
  };
}
