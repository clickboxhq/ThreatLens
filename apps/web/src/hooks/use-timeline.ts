import { useSoc } from "@/lib/store";
import { timelineService } from "@/services/timeline";

export function useTimeline() {
  const globalTimeline = useSoc((s) => s.globalTimeline);
  const cases = useSoc((s) => s.cases);
  const events = timelineService.eventsFor(globalTimeline);
  const casesWithTimelineCount = Object.keys(cases).filter(
    (k) => cases[k].timeline.length > 0,
  ).length;
  return { globalTimeline, events, casesWithTimelineCount };
}
