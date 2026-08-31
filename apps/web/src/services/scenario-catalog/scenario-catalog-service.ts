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
}

/** GET /scenarios/recommended — the scenario best covering the learner's weakest tactic.
 *
 * The matching runs server-side deliberately. It has to read each scenario's required
 * techniques to rank candidates, and that list is the scoring answer key — so it must never
 * reach the browser. This response names the tactic being worked on, which is the useful
 * *reason*, and no techniques. */
export interface ScenarioRecommendation {
  scenarioId: string;
  scenarioSlug: string;
  scenarioTitle: string;
  tactic: string;
  tacticName: string;
  percent: number;
  hitCount: number;
  requiredCount: number;
}

export function getRecommendedScenario(): Promise<ScenarioRecommendation | null> {
  return apiClient.get<ScenarioRecommendation | null>("/scenarios/recommended");
}

export function listRealScenarios(): Promise<RealScenario[]> {
  return apiClient.get<RealScenario[]>("/scenarios");
}
