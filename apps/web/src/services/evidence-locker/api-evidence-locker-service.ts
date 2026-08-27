import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { EvidenceLockerService } from "./evidence-locker-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`EvidenceLockerService.${method}`);
};

export const apiEvidenceLockerService: EvidenceLockerService = {
  listArtifacts: () => notConnected("listArtifacts"),
  getStats: () => notConnected("getStats"),
  listCoverageBySource: () => notConnected("listCoverageBySource"),
  listGradingImpact: () => notConnected("listGradingImpact"),
};
