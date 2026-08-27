import type {
  ActionLogEntry,
  CaseState,
  CaseStatus,
  CaseVerdict,
  ScoreBreakdown,
} from "@/types/investigations";
import type { SecurityEvent, MitreTechnique, ResponseAction } from "@/types/telemetry";

/**
 * The investigation/case lifecycle: telemetry search, evidence pinning,
 * timeline curation, notes, technique tagging, hints, and scored
 * submission. Ground truth is never part of this surface — callers only
 * ever see the derived accessors (getMinEvidence/getHint/getNarrative),
 * never the raw answer key.
 */
export interface InvestigationsService {
  // Reference/telemetry data (read-only, static in the mock adapter)
  searchTelemetry(query: string): SecurityEvent[];
  eventById(id: string): SecurityEvent | undefined;
  listMitreTechniques(): MitreTechnique[];
  listResponseActions(): ResponseAction[];
  listDismissalReasons(): string[];

  // Scoring/ground-truth-derived accessors — deliberately narrow
  getMinEvidence(caseId: string): number;
  getHint(caseId: string, hintsUsed: number): string | undefined;
  getNarrative(caseId: string): string | undefined;
  scoreSubmission(caseId: string, caseState: CaseState, verdict: CaseVerdict): ScoreBreakdown;

  // Case mutations
  setCaseStatus(id: string, status: CaseStatus): void;
  pinEvidence(id: string, eventId: string, justification: string): void;
  unpinEvidence(id: string, eventId: string): void;
  tagEvidence(id: string, eventId: string, technique: string): void;
  addToTimeline(id: string, eventId: string): void;
  removeFromTimeline(id: string, eventId: string): void;
  addCaseNote(id: string, body: string): void;
  toggleTechniqueTag(id: string, technique: string): void;
  setCaseSummary(id: string, summary: string): void;
  useHint(id: string): void;
  logAction(id: string, entry: Omit<ActionLogEntry, "id" | "ts" | "actor">): void;
  submitCase(id: string, verdict: CaseVerdict): void;
  reopenCase(id: string, feedback: string): void;
}
