export type StudentRisk = "Low" | "Medium" | "High";

export type StudentAnalyticsRow = {
  name: string;
  cohort: string;
  inv: number;
  acc: number;
  evid: number;
  mitre: number;
  risk: StudentRisk;
};

export type StudentAnalyticsStats = {
  analystsTracked: number;
  cohortAccuracy: number;
  evidenceRate: number;
  atRisk: number;
};

export type FailureMode = { label: string; value: string; meter: number };
