import type { Cohort, CohortStats, TrackCompletion } from "@/types/cohorts";

export interface CohortsService {
  listCohorts(): Promise<Cohort[]>;
  getStats(): Promise<CohortStats>;
  listTrackCompletion(): Promise<TrackCompletion[]>;
}
