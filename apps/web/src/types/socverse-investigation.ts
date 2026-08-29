// Types matching SOCVerse's real API responses for the investigation domain — sessions,
// incidents, evidence, timeline, hints, MITRE techniques, search, and response actions.
// Verified directly against apps/api's controllers/DTOs (see the merge plan's research), not
// inferred from the mock this replaces.

export type SessionStatus = "active" | "submitted" | "scored" | "abandoned";

export interface SessionDto {
  id: string;
  scenarioId: string;
  // The case briefing — what the Student is being asked to look into. These are the public
  // scenario-catalog fields only; the ground truth's own narrative_summary (which describes
  // what actually happened) is deliberately never sent to the client.
  scenarioTitle: string;
  scenarioSummary: string;
  scenarioCategory: string;
  scenarioDifficulty: string;
  estimatedMinutes: number;
  status: SessionStatus;
  // A crude but honest readiness signal (§17.9's REST-polling fallback) — telemetry generation
  // runs as an async job, so a freshly-created session has nothing to investigate yet.
  ready: boolean;
  startedAt: string;
  submittedAt: string | null;
  expiresAt: string;
  currentScenarioTime: string | null;
}

export type IncidentStatus = "open" | "investigating" | "contained" | "closed" | "reopened";
export type IncidentVerdict = "true_positive" | "false_positive" | "benign_positive";

export interface IncidentDto {
  id: string;
  title: string;
  status: IncidentStatus;
  verdict: IncidentVerdict | null;
  summary: string | null;
  linkedAlertIds: string[];
  techniques: { id: string; techniqueId: string; name: string }[];
  createdAt: string;
  closedAt: string | null;
}

export interface IncidentSummaryDto {
  id: string;
  title: string;
  status: IncidentStatus;
  verdict: IncidentVerdict | null;
  linkedAlertCount: number;
  createdAt: string;
  closedAt: string | null;
}

export interface EvidenceItemDto {
  id: string;
  incidentId: string;
  eventTable: string;
  eventId: string;
  justification: string;
  mitreTechniqueId: string | null;
  pinnedBy: string;
  pinnedAt: string;
  // Server-resolved display text (apps/api's EvidenceNotesService.resolveDisplay) — the raw
  // row is just an (eventTable, eventId) pointer, not enough to render on its own. Null only
  // if the underlying event was somehow deleted after being pinned.
  display: { title: string; summary: string } | null;
}

export type TimelineEntityType = "identity" | "device" | "mailbox";

export interface TimelineItemDto {
  id: string;
  eventTable: string;
  occurredAt: string;
  entityType: TimelineEntityType;
  entityId: string;
  entityLabel: string;
  summary: string;
  source: ("evidence" | "manual")[];
  relatedItemIds: string[];
}

export interface NoteDto {
  id: string;
  incidentId: string;
  body: string;
  createdBy: string;
  createdAt: string;
}

export interface HintDto {
  index: number;
  unlockCostPercent: number;
  unlocked: boolean;
  text: string | null;
}

export interface MitreTechniqueDto {
  id: string;
  techniqueId: string;
  name: string;
  tactic: string;
}

// The 6 options ThreatLens's "Response actions" panel offers — see
// apps/api/.../dto/incident.dto.ts's LogResponseActionDto for why this is a flat list with no
// per-entity target, not 6 different entity-scoped calls.
export const RESPONSE_ACTION_TYPES = [
  "isolate_device",
  "disable_account",
  "force_password_reset",
  "revoke_tokens",
  "block_sender",
  "block_ip",
] as const;
export type ResponseActionType = (typeof RESPONSE_ACTION_TYPES)[number];

export interface ScoreRubricBreakdown {
  missedTechniques: { id: string; techniqueId: string; name: string }[];
  missedEvidence: { eventTable: string; summary: string }[];
  [key: string]: unknown;
}

export interface ScoreDto {
  overallPercent: number;
  techniqueAccuracyPercent: number;
  evidencePrecisionPercent: number;
  evidenceRecallPercent: number;
  falsePositiveCount: number;
  hintPenaltyPercent: number;
  timeToResolutionSeconds: number | null;
  verdictCorrect: boolean;
  rubricBreakdown: ScoreRubricBreakdown;
  scoredAt: string;
}

export type SearchEntityType =
  | "sign_in_event"
  | "email_message"
  | "cloud_event"
  | "process_event"
  | "file_event"
  | "network_event"
  | "http_request";

export interface SearchResultItem {
  entityType: SearchEntityType;
  occurredAt: string;
  data: Record<string, unknown>;
}
