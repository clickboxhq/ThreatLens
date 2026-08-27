import { useQuery } from "@tanstack/react-query";
import { mitreExplorerService } from "@/services/mitre-explorer";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useMitreExplorer() {
  const masteryQuery = useQuery({
    queryKey: [...queryKeys.mitreExplorer, "mastery"],
    queryFn: () => mitreExplorerService.listMastery(),
  });
  const techniquesQuery = useQuery({
    queryKey: [...queryKeys.mitreExplorer, "techniques"],
    queryFn: () => mitreExplorerService.listPracticedTechniques(),
  });
  return {
    mastery: masteryQuery.data ?? [],
    techniques: techniquesQuery.data ?? [],
    state: deriveViewState(masteryQuery),
  };
}
