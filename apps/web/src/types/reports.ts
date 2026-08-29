import type { TimelineEntityType } from "./timeline";

// Backed by SOCVerse's real GET /reports/mine and GET /sessions/:id/incidents/:id/report
// (apps/api's ReportService) — "the final report artifact assembled from Notes + Evidence
// Collection + Timeline + Verdict" (§2.14), only ever available once an incident is closed.
export type ReportListItem = {
  sessionId: string;
  incidentId: string;
  incidentTitle: string;
  scenarioTitle: string;
  verdict: string | null;
  closedAt: string | null;
};

export type ReportTechnique = { id: string; techniqueId: string; name: string };
export type ReportNote = { id: string; body: string; createdAt: string };
export type ReportEvidenceItem = {
  id: string;
  eventTable: string;
  eventId: string;
  justification: string;
  mitreTechniqueId: string | null;
  pinnedAt: string;
  summary: string;
};
export type ReportTimelineItem = {
  id: string;
  eventTable: string;
  occurredAt: string;
  entityType: TimelineEntityType;
  entityId: string;
  entityLabel: string;
  summary: string;
  source: ("evidence" | "manual")[];
  relatedItemIds: string[];
};

export type IncidentReport = {
  incident: {
    id: string;
    title: string;
    status: string;
    verdict: string | null;
    summary: string | null;
    techniques: ReportTechnique[];
    createdAt: string;
    closedAt: string | null;
  };
  notes: ReportNote[];
  evidence: ReportEvidenceItem[];
  timeline: ReportTimelineItem[];
  score: { overallPercent: number; verdictCorrect: boolean; scoredAt: string } | null;
};
