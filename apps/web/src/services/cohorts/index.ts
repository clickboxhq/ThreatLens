import { apiCohortsService } from "./api-cohorts-service";
import type { CohortsService } from "./cohorts-service";

export const cohortsService: CohortsService = apiCohortsService;

export type { CohortsService } from "./cohorts-service";
