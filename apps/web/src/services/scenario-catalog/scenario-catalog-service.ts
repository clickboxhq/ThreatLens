import { apiClient } from "@/lib/api-client";

// ThreatLens's real GET /scenarios (apps/api's ScenarioCatalogController) — published
// scenarios only, never the ground-truth-bearing scenario version underneath.
export interface RealScenario {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  difficulty: string;
  estimatedMinutes: number;
  /**
   * Tactic-level (not technique-level) coverage — e.g. "Credential Access" plus how many
   * required techniques fall under it. Deliberately not exact MITRE technique IDs: those
   * are the scoring rubric's answer key (see the backend controller's own comment) and must
   * never be readable before a student starts the scenario.
   */
  tacticCoverage: { tactic: string; techniqueCount: number }[];
}

export function listRealScenarios(): Promise<RealScenario[]> {
  return apiClient.get<RealScenario[]>("/scenarios");
}
