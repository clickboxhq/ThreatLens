import { apiClient } from "@/lib/api-client";

// SOCVerse's real GET /scenarios (apps/api's ScenarioCatalogController) — published scenarios
// only, never the ground-truth-bearing scenario version underneath.
export interface RealScenario {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  difficulty: string;
  estimatedMinutes: number;
  /** MITRE technique IDs (e.g. "T1078") this scenario's kill chain actually exercises. */
  techniqueIds: string[];
}

export function listRealScenarios(): Promise<RealScenario[]> {
  return apiClient.get<RealScenario[]>("/scenarios");
}
