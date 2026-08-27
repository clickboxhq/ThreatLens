import type { TimelineService } from "./timeline-service";
import { mockTimelineService } from "./mock-timeline-service";

export const timelineService: TimelineService = mockTimelineService;
export type { TimelineService } from "./timeline-service";
