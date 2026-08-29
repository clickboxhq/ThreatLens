// Backed by SOCVerse's real GET /evidence/mine (apps/api's EvidenceLockerController) — every
// artifact the Student has pinned across every incident they've ever worked. There is no real
// SHA-256/chain-of-custody concept in the backend (these are database rows, not files), so
// this deliberately doesn't carry those fields the way ThreatLens's original mock did.
export type EvidenceArtifact = {
  id: string;
  sessionId: string;
  scenarioTitle: string;
  incidentId: string;
  incidentTitle: string;
  eventTable: string;
  title: string;
  summary: string;
  mitreTechnique: { techniqueId: string; name: string } | null;
  justification: string;
  pinnedAt: string;
};

export type EvidenceCoverageItem = { label: string; count: number };
