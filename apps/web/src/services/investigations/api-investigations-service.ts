import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { InvestigationsService } from "./investigations-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`InvestigationsService.${method}`);
};

/**
 * Future backend adapter. Every method is a documented stub — swap the
 * `investigationsService` export in index.ts to this once a real API
 * exists. Note: the real backend must own scoring/ground-truth entirely
 * server-side; this adapter's scoring methods must never compute a score
 * client-side once connected.
 */
export const apiInvestigationsService: InvestigationsService = {
  searchTelemetry: () => notConnected("searchTelemetry"),
  eventById: () => notConnected("eventById"),
  listMitreTechniques: () => notConnected("listMitreTechniques"),
  listResponseActions: () => notConnected("listResponseActions"),
  listDismissalReasons: () => notConnected("listDismissalReasons"),
  getMinEvidence: () => notConnected("getMinEvidence"),
  getHint: () => notConnected("getHint"),
  getNarrative: () => notConnected("getNarrative"),
  scoreSubmission: () => notConnected("scoreSubmission"),
  setCaseStatus: () => notConnected("setCaseStatus"),
  pinEvidence: () => notConnected("pinEvidence"),
  unpinEvidence: () => notConnected("unpinEvidence"),
  tagEvidence: () => notConnected("tagEvidence"),
  addToTimeline: () => notConnected("addToTimeline"),
  removeFromTimeline: () => notConnected("removeFromTimeline"),
  addCaseNote: () => notConnected("addCaseNote"),
  toggleTechniqueTag: () => notConnected("toggleTechniqueTag"),
  setCaseSummary: () => notConnected("setCaseSummary"),
  useHint: () => notConnected("useHint"),
  logAction: () => notConnected("logAction"),
  submitCase: () => notConnected("submitCase"),
  reopenCase: () => notConnected("reopenCase"),
};
