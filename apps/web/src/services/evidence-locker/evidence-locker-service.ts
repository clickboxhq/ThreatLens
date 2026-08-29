import type { EvidenceArtifact } from "@/types/evidence-locker";

export interface EvidenceLockerService {
  /** Every artifact the Student has pinned across every incident they've ever worked. */
  listMine(): Promise<EvidenceArtifact[]>;
}
