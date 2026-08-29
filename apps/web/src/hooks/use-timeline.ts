import { useQuery } from "@tanstack/react-query";
import { timelineService } from "@/services/timeline";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useTimeline() {
  const query = useQuery({
    queryKey: [...queryKeys.timeline, "mine"],
    queryFn: () => timelineService.listMine(),
  });
  const events = query.data ?? [];
  const casesWithTimelineCount = new Set(events.map((e) => e.incidentId)).size;

  return {
    events,
    casesWithTimelineCount,
    state: deriveViewState(query),
  };
}
