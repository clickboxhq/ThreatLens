import { apiCareerProgressionService } from "./api-career-progression-service";
import type { CareerProgressionService } from "./career-progression-service";

export const careerProgressionService: CareerProgressionService = apiCareerProgressionService;

export type { CareerProgressionService } from "./career-progression-service";
