import type { Assessment, AssessmentStats, GradingBreakdownItem } from "@/types/assessments";

export interface AssessmentsService {
  listAssessments(): Promise<Assessment[]>;
  getStats(): Promise<AssessmentStats>;
  listGradingBreakdown(): Promise<GradingBreakdownItem[]>;
}
