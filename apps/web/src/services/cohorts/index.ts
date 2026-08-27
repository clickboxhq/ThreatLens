import type { CohortsService } from "./cohorts-service";
import { mockCohortsService } from "./mock-cohorts-service";

export const cohortsService: CohortsService = mockCohortsService;
export type { CohortsService } from "./cohorts-service";
