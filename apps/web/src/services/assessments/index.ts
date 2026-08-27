import type { AssessmentsService } from "./assessments-service";
import { mockAssessmentsService } from "./mock-assessments-service";

export const assessmentsService: AssessmentsService = mockAssessmentsService;
export type { AssessmentsService } from "./assessments-service";
