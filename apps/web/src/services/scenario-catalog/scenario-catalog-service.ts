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

export function listRealScenarios(): Promise<RealScenario[]> {
  return apiClient.get<RealScenario[]>("/scenarios");
}
