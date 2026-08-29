import { useQuery } from "@tanstack/react-query";
import { sessionsService } from "@/services/sessions";
import { listRealScenarios } from "@/services/scenario-catalog/scenario-catalog-service";
import { investigationsService } from "@/services/investigations";
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
 * three already-fetched real domains rather than adding a new data source.
 */
export function useLearningRecommendation() {
  const query = useQuery({
    queryKey: [...queryKeys.mitreExplorer, "recommendation"],
    queryFn: async (): Promise<LearningRecommendation | undefined> => {
      const [skillRadar, scenarios, techniques] = await Promise.all([
        sessionsService.getSkillRadar(),
        listRealScenarios(),
        Promise.resolve(investigationsService.listMitreTechniques()),
      ]);
      if (skillRadar.length === 0 || scenarios.length === 0) return undefined;

      const weakest = [...skillRadar].sort((a, b) => a.percent - b.percent)[0];

      let best = scenarios[0];
      let bestOverlap = -1;
      for (const s of scenarios) {
        // s.techniqueIds are real database technique-id strings ("T1078", etc.) from this
        // scenario's current version — match against the tactic code the weakest skill-radar
        // entry names (e.g. "TA0006"), the same field computeSkillRadar itself groups by.
        const overlap = s.techniqueIds.filter((id) =>
          techniques.some((t) => t.techniqueId === id && t.tactic === weakest.tactic),
        ).length;
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
