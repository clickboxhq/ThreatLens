import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { TimelineService } from "./timeline-service";

export const apiTimelineService: TimelineService = {
  eventsFor: () => {
    throw new NotConnectedError("TimelineService.eventsFor");
  },
};
