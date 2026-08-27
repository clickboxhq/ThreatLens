import type { Note } from "./common";

export type CaseStatus = "open" | "investigating" | "contained" | "closed" | "reopened";
export type CaseVerdict = "true-positive" | "false-positive" | "benign-positive";

export type EvidenceItem = {
  eventId: string;
  justification: string;
  technique?: string;
  pinnedAt: string;
};

export type ActionLogEntry = {
  id: string;
  actionId: string;
  label: string;
  target: string;
  actor: string;
  ts: string;
  reason?: string;
};

export type ScoreBreakdown = {
  total: number;
  techniqueAccuracy: number;
  evidencePrecision: number;
  evidenceRecall: number;
  falsePositiveRate: number;
  responseActions: number;
  hintPenalty: number;
  missedEvidence: string[];
  noiseIncluded: string[];
  missedTechniques: string[];
  verdictCorrect: boolean;
  scoredAt: string;
};

export type CaseState = {
  status: CaseStatus;
  verdict?: CaseVerdict;
  summary: string;
  techniqueTags: string[];
  evidence: EvidenceItem[];
  timeline: string[];
  notes: Note[];
  actions: ActionLogEntry[];
  hintsUsed: number;
  statusHistory: { status: CaseStatus; ts: string }[];
  submittedAt?: string;
  score?: ScoreBreakdown;
  instructorFeedback?: { body: string; adjustment: number; ts: string };
};
