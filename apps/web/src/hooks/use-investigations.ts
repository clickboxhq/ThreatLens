import { useMemo } from "react";
import { useSoc, getCase } from "@/lib/store";
import type { CaseStatus, CaseVerdict, ActionLogEntry } from "@/types/investigations";
import { investigationsService } from "@/services/investigations";

/**
 * Everything a single case workspace needs: the reactive case/incident/
 * linked-alert state (read straight from the store so React re-renders
 * exactly as before), plus the investigations service for mutations and
 * for every ground-truth-derived accessor (minEvidence/hint/narrative) —
 * this hook is the only thing route components touch; none of them import
 * the store or scoring data directly anymore.
 */
export function useInvestigation(id: string) {
  const incident = useSoc((s) => s.incidents.find((i) => i.id === id));
  const caseState = useSoc((s) => getCase(s, id));
  const allAlerts = useSoc((s) => s.alerts);
  const linkedAlerts = useMemo(() => allAlerts.filter((a) => a.incidentId === id), [allAlerts, id]);

  return {
    incident,
    caseState,
    linkedAlerts,
    minEvidence: investigationsService.getMinEvidence(id),
    hint: (hintsUsed: number) => investigationsService.getHint(id, hintsUsed),
    narrative: investigationsService.getNarrative(id),
    mitreTechniques: investigationsService.listMitreTechniques(),
    responseActions: investigationsService.listResponseActions(),
    searchTelemetry: (query: string) => investigationsService.searchTelemetry(query),
    eventById: (eventId: string) => investigationsService.eventById(eventId),
    setCaseStatus: (status: CaseStatus) => investigationsService.setCaseStatus(id, status),
    pinEvidence: (eventId: string, justification: string) =>
      investigationsService.pinEvidence(id, eventId, justification),
    unpinEvidence: (eventId: string) => investigationsService.unpinEvidence(id, eventId),
    tagEvidence: (eventId: string, technique: string) =>
      investigationsService.tagEvidence(id, eventId, technique),
    addToTimeline: (eventId: string) => investigationsService.addToTimeline(id, eventId),
    removeFromTimeline: (eventId: string) => investigationsService.removeFromTimeline(id, eventId),
    addCaseNote: (body: string) => investigationsService.addCaseNote(id, body),
    toggleTechniqueTag: (technique: string) =>
      investigationsService.toggleTechniqueTag(id, technique),
    setCaseSummary: (summary: string) => investigationsService.setCaseSummary(id, summary),
    useHint: () => investigationsService.useHint(id),
    logAction: (entry: Omit<ActionLogEntry, "id" | "ts" | "actor">) =>
      investigationsService.logAction(id, entry),
    submitCase: (verdict: CaseVerdict) => investigationsService.submitCase(id, verdict),
    reopenCase: (feedback: string) => investigationsService.reopenCase(id, feedback),
  };
}
