import { useQuery } from "@tanstack/react-query";
import { threatIntelService } from "@/services/threat-intel";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useThreatIntel() {
  const query = useQuery({
    queryKey: [...queryKeys.threatIntel, "mine"],
    queryFn: () => threatIntelService.listMine(),
  });
  return {
    actors: query.data?.actors ?? [],
    iocs: query.data?.indicators ?? [],
    state: deriveViewState(query, (data) => data.indicators.length === 0),
  };
}
