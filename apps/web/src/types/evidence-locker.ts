import type { Severity } from "./common";

export type EvidenceArtifact = {
  id: string;
  name: string;
  type: string;
  inv: string;
  sev: Severity;
  hash: string;
  who: string;
  when: string;
};

export type EvidenceLockerStats = {
  artifactsCollected: number;
  collectionRate: number;
  requiredOutstanding: number;
  chainOfCustody: number;
};

export type EvidenceCoverageItem = { label: string; value: string; meter: number };
export type GradingImpactItem = { label: string; value: string };
