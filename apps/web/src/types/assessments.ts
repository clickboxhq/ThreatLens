export type AssessmentStatus = "open" | "in-progress" | "resolved";

export type Assessment = {
  id: string;
  name: string;
  cohort: string;
  window: string;
  submitted: number;
  total: number;
  avg: number;
  status: AssessmentStatus;
};

export type AssessmentStats = {
  scheduled: number;
  submissions: number;
  submissionsExpected: number;
  averageGrade: number;
  awaitingReview: number;
};

export type GradingBreakdownItem = { label: string; value: string; meter: number };
