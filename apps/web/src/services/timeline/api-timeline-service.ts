import { apiClient } from "@/lib/api-client";
import type { TimelineService } from "./timeline-service";
import type { GlobalTimelineItem } from "@/types/timeline";

export const apiTimelineService: TimelineService = {
  listMine: () => apiClient.get<GlobalTimelineItem[]>("/timeline/mine"),
};
