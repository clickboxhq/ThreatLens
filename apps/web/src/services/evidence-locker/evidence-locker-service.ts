import type {
  EvidenceArtifact,
  EvidenceLockerStats,
  EvidenceCoverageItem,
  GradingImpactItem,
} from "@/types/evidence-locker";

export interface EvidenceLockerService {
  listArtifacts(): Promise<EvidenceArtifact[]>;
  getStats(): Promise<EvidenceLockerStats>;
  listCoverageBySource(): Promise<EvidenceCoverageItem[]>;
  listGradingImpact(): Promise<GradingImpactItem[]>;
}
