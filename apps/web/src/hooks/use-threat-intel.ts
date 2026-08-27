import { useQuery } from "@tanstack/react-query";
import { threatIntelService } from "@/services/threat-intel";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useThreatIntel() {
  const actorsQuery = useQuery({
    queryKey: [...queryKeys.threatIntel, "actors"],
    queryFn: () => threatIntelService.listActors(),
  });
  const iocsQuery = useQuery({
    queryKey: [...queryKeys.threatIntel, "iocs"],
    queryFn: () => threatIntelService.listIocs(),
  });
  return {
    actors: actorsQuery.data ?? [],
    iocs: iocsQuery.data ?? [],
    state: deriveViewState(actorsQuery),
  };
}
