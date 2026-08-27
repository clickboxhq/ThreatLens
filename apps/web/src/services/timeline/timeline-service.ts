import type { SecurityEvent } from "@/types/telemetry";

export interface TimelineService {
  /** Resolves curated event ids to full events, chronologically sorted. */
  eventsFor(ids: string[]): SecurityEvent[];
}
