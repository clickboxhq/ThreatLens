import { apiTimelineService } from "./api-timeline-service";
import type { TimelineService } from "./timeline-service";

export const timelineService: TimelineService = apiTimelineService;
export type { TimelineService } from "./timeline-service";
