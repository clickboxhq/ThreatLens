import { securityEvents } from "@/services/investigations/telemetry-data";
import type { TimelineService } from "./timeline-service";

export const mockTimelineService: TimelineService = {
  eventsFor: (ids) =>
    ids
      .map((id) => securityEvents.find((e) => e.id === id))
      .filter((e): e is (typeof securityEvents)[number] => Boolean(e))
      .sort((a, b) => a.ts.localeCompare(b.ts)),
};
