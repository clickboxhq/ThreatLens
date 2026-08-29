import { apiEvidenceLockerService } from "./api-evidence-locker-service";
import type { EvidenceLockerService } from "./evidence-locker-service";

export const evidenceLockerService: EvidenceLockerService = apiEvidenceLockerService;

export type { EvidenceLockerService } from "./evidence-locker-service";
