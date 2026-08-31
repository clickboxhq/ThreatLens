import { useQuery } from "@tanstack/react-query";
import { sessionsService } from "@/services/sessions";
import { listRealScenarios } from "@/services/scenario-catalog/scenario-catalog-service";
import { queryKeys } from "./query-keys";

export type LearningRecommendation = {
  weakTactic: string;
  mastery: number;
  scenarioId: string;
  scenarioTitle: string;
  reason: string;
};

/**
 * Deterministic derivation (no AI): lowest-mastery MITRE tactic (from the real skill radar) ->
 * the published scenario whose kill chain covers that tactic's techniques the most. Composes
 * two already-fetched real domains rather than adding a new data source.
 *
 * Deliberately matches on tactic-level coverage, not exact technique IDs: the backend
 * (ScenarioCatalogController) only ever returns `tacticCoverage` for this reason — the exact
 * technique list is the scoring rubric's answer key and must never reach the client pre-session.
 */
export function useLearningRecommendation() {
  const query = useQuery({
    queryKey: [...queryKeys.mitreExplorer, "recommendation"],
    queryFn: async (): Promise<LearningRecommendation | undefined> => {
      const [skillRadar, scenarios] = await Promise.all([
        sessionsService.getSkillRadar(),
        listRealScenarios(),
      ]);
      if (skillRadar.length === 0 || scenarios.length === 0) return undefined;

      const weakest = [...skillRadar].sort((a, b) => a.percent - b.percent)[0];

      let best = scenarios[0];
      let bestOverlap = -1;
      for (const s of scenarios) {
        // weakest.tactic is the same raw MITRE tactic string (e.g. "Credential Access") the
        // backend groups tacticCoverage by, so this is a direct string match — no separate
        // technique lookup needed.
        const overlap =
          s.tacticCoverage.find((tc) => tc.tactic === weakest.tactic)?.techniqueCount ?? 0;
        if (overlap > bestOverlap) {
          best = s;
          bestOverlap = overlap;
        }
      }

      return {
        weakTactic: weakest.tacticName,
        mastery: weakest.percent,
        scenarioId: best.id,
        scenarioTitle: best.title,
        reason: `${weakest.tacticName} is your lowest-mastery tactic at ${weakest.percent}% (${weakest.hitCount}/${weakest.requiredCount} required techniques tagged).`,
      };
    },
  });

  return { recommendation: query.data, isPending: query.isPending };
}
