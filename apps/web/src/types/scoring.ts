/**
 * Shape of the hidden answer key for a scenario. The TYPE is safe to share —
 * it describes structure, not content. The actual DATA (src/services/investigations/scoring-data.ts)
 * must never be exported from a public barrel; only the Investigations service may import it.
 */
export type GroundTruth = {
  incidentId: string;
  scenarioId: string;
  verdict: "true-positive" | "false-positive" | "benign-positive";
  techniques: string[];
  evidenceIds: string[];
  /** events that look relevant but are noise — including them costs precision */
  noiseIds: string[];
  requiredActions: string[];
  narrative: string;
  minEvidence: number;
};
