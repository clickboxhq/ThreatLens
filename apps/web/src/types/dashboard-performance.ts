import type { Severity } from "./common";

export type TrainingKpi = {
  label: string;
  value: string;
  delta: string;
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
  title: string;
  subjectLabel: string;
  subject: string;
  severity: Severity;
  status: string;
  statusLabel: string;
  mitre: string;
  progress: number;
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
