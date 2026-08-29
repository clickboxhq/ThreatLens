import type { GlobalTimelineItem } from "@/types/timeline";

export interface TimelineService {
  /** Every curated event across every incident the Student has ever worked, chronologically. */
  listMine(): Promise<GlobalTimelineItem[]>;
}
