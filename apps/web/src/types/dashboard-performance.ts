// Every shape here is derived client-side from real, already-fetched domains (sessions,
// cohort assignments, the scenario catalog, the skill radar) — there is no single
// "dashboard performance" endpoint on the backend, so these are view-model types for
// use-dashboard-performance.ts's aggregation, not a wire contract.

export type TrainingKpi = {
  label: string;
  value: string;
  tone: "default" | "critical" | "success" | "info";
};

export type InvestigationPerformancePoint = {
  m: string;
  started: number;
  completed: number;
  score: number;
  mttr: number;
};

export type RecentInvestigation = {
  id: string;
  scenarioTitle: string;
  scenarioCategory: string;
  status: string;
  statusLabel: string;
  overallPercent: number | null;
  verdictCorrect: boolean | null;
  ts: string;
};

export type AssignedScenario = {
  id: string;
  title: string;
  difficulty: string;
  progress: number;
  score: number | null;
  duration: string;
};
