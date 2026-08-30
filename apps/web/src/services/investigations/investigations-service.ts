import type { InstructorFeedbackDto } from "@/types/socverse-instructor";
import type {
  EvidenceItemDto,
  HintDto,
  IncidentDto,
  IncidentSummaryDto,
  IncidentVerdict,
  MitreTechniqueDto,
  NoteDto,
  ResponseActionType,
  ScoreDto,
  SearchResultItem,
  SessionDto,
  TimelineItemDto,
} from "@/types/socverse-investigation";
import type { InvestigationTaskListDto } from "@/types/socverse-investigation";

/**
 * The real investigation lifecycle against SOCVerse's backend: session creation/polling,
 * incident open/close, evidence pinning, timeline curation, notes, hints, response actions,
 * scoped search, and server-computed scoring. Ground truth is never part of this surface —
 * the client only ever sends its own inputs and receives a score back, matching every other
 * ground-truth-never-leaves-the-server boundary in this codebase.
 *
 * Replaces the pre-merge mock version entirely rather than keeping a mock/api adapter split —
 * there's no meaningful mock left to keep once the whole point was proving out the real
 * integration (see the merge plan's Phase 2).
 */
export interface InvestigationsService {
  createSession(scenarioId: string): Promise<SessionDto>;
  getSession(sessionId: string): Promise<SessionDto>;

  createIncident(sessionId: string, title: string): Promise<IncidentDto>;
  listIncidents(sessionId: string): Promise<IncidentSummaryDto[]>;
  getIncident(sessionId: string, incidentId: string): Promise<IncidentDto>;
  closeIncident(
    sessionId: string,
    incidentId: string,
    input: { verdict: IncidentVerdict; summary: string; mitreTechniqueIds: string[] },
  ): Promise<IncidentDto>;

  listEvidence(sessionId: string, incidentId: string): Promise<EvidenceItemDto[]>;
  pinEvidence(
    sessionId: string,
    incidentId: string,
    input: {
      eventTable: string;
      eventId: string;
      justification: string;
      mitreTechniqueId?: string;
    },
  ): Promise<EvidenceItemDto>;
  removeEvidence(sessionId: string, incidentId: string, evidenceId: string): Promise<void>;

  getTimeline(sessionId: string, incidentId: string): Promise<TimelineItemDto[]>;
  addToTimeline(
    sessionId: string,
    incidentId: string,
    input: { eventTable: string; eventId: string },
  ): Promise<TimelineItemDto>;
  removeFromTimeline(
    sessionId: string,
    incidentId: string,
    eventTable: string,
    eventId: string,
  ): Promise<void>;

  listNotes(sessionId: string, incidentId: string): Promise<NoteDto[]>;
  addNote(sessionId: string, incidentId: string, body: string): Promise<NoteDto>;

  listHints(sessionId: string): Promise<HintDto[]>;
  unlockHint(sessionId: string, index: number): Promise<HintDto[]>;

  logResponseAction(
    sessionId: string,
    incidentId: string,
    actionType: ResponseActionType,
    targetType: string,
  ): Promise<void>;

  search(
    sessionId: string,
    input: { filters?: { field: string; value: string }[]; freetext?: string },
  ): Promise<SearchResultItem[]>;

  listMitreTechniques(): Promise<MitreTechniqueDto[]>;

  /** Answers one specific (type, value) query against this session's scenario — never a
   * browsable list, since that would hand back the scenario's full indicator set. A real
   * match is recorded server-side into the Student's own Threat Intelligence history. */
  lookupThreatIntel(
    sessionId: string,
    type: "hash" | "ip" | "domain" | "url",
    value: string,
  ): Promise<{
    value: string;
    type: string;
    reputation: "malicious" | "suspicious" | "unknown" | "known_good";
    actorAttribution: string | null;
    context: string | null;
  }>;

  listTasks(sessionId: string, incidentId: string): Promise<InvestigationTaskListDto>;
  setTaskCompletion(
    sessionId: string,
    incidentId: string,
    taskKey: string,
    completed: boolean,
  ): Promise<InvestigationTaskListDto>;

  submitSession(sessionId: string, incidentIds: string[]): Promise<void>;
  /** Returns null while the async scoring job hasn't finished yet (server's NOT_SCORED_YET). */
  getScore(sessionId: string): Promise<ScoreDto | null>;
  /** Instructor feedback on a closed incident — the student-facing read side of the review
   * loop (§2.15/§6.20). Empty until an instructor actually reviews the submission. */
  listFeedback(sessionId: string, incidentId: string): Promise<InstructorFeedbackDto[]>;
}
