import { useSoc } from "@/lib/store";
import type { InvestigationsService } from "./investigations-service";
import { scoreCase, getMinEvidence, getHint, getNarrative } from "./scoring";
import {
  securityEvents,
  mitreTechniques,
  responseActions,
  dismissalReasons,
  eventById,
} from "./telemetry-data";

export const mockInvestigationsService: InvestigationsService = {
  searchTelemetry: (query) => {
    const q = query.trim().toLowerCase();
    if (!q) return securityEvents;
    // field=value structured filter, otherwise freetext
    const m = q.match(/^(\w+)\s*=\s*(.+)$/);
    if (m) {
      const [, field, value] = m;
      return securityEvents.filter((e) => {
        const hay =
          field === "entity"
            ? e.entity
            : field === "source"
              ? e.source
              : field === "mitre"
                ? (e.mitre ?? "")
                : e.detail;
        return hay.toLowerCase().includes(value.trim());
      });
    }
    return securityEvents.filter((e) =>
      `${e.detail} ${e.entity} ${e.source} ${e.action} ${e.mitre ?? ""}`.toLowerCase().includes(q),
    );
  },
  eventById: (id) => eventById(id),
  listMitreTechniques: () => mitreTechniques,
  listResponseActions: () => responseActions,
  listDismissalReasons: () => dismissalReasons,

  getMinEvidence: (caseId) => getMinEvidence(caseId),
  getHint: (caseId, hintsUsed) => getHint(caseId, hintsUsed),
  getNarrative: (caseId) => getNarrative(caseId),
  scoreSubmission: (caseId, caseState, verdict) => scoreCase(caseId, caseState, verdict),

  setCaseStatus: (id, status) => useSoc.getState().setCaseStatus(id, status),
  pinEvidence: (id, eventId, justification) =>
    useSoc.getState().pinEvidence(id, eventId, justification),
  unpinEvidence: (id, eventId) => useSoc.getState().unpinEvidence(id, eventId),
  tagEvidence: (id, eventId, technique) => useSoc.getState().tagEvidence(id, eventId, technique),
  addToTimeline: (id, eventId) => useSoc.getState().addToTimeline(id, eventId),
  removeFromTimeline: (id, eventId) => useSoc.getState().removeFromTimeline(id, eventId),
  addCaseNote: (id, body) => useSoc.getState().addCaseNote(id, body),
  toggleTechniqueTag: (id, technique) => useSoc.getState().toggleTechniqueTag(id, technique),
  setCaseSummary: (id, summary) => useSoc.getState().setCaseSummary(id, summary),
  useHint: (id) => useSoc.getState().useHint(id),
  logAction: (id, entry) => useSoc.getState().logAction(id, entry),
  submitCase: (id, verdict) => useSoc.getState().submitCase(id, verdict),
  reopenCase: (id, feedback) => useSoc.getState().reopenCase(id, feedback),
};
