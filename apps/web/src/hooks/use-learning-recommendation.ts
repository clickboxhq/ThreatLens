import { useQuery } from "@tanstack/react-query";
import { getRecommendedScenario } from "@/services/scenario-catalog/scenario-catalog-service";
import { queryKeys } from "./query-keys";

export type LearningRecommendation = {
  weakTactic: string;
  mastery: number;
  scenarioId: string;
  scenarioTitle: string;
  reason: string;
};

/**
 * The scenario that best covers the learner's weakest MITRE tactic.
 *
 * This used to be computed in the browser by comparing each scenario's technique list against
 * the skill radar — which required the catalog to publish those technique lists, and that list
 * is the scoring answer key. The matching now happens server-side and returns a scenario plus
 * the tactic being worked on, never the techniques.
 */
export function useLearningRecommendation() {
  const query = useQuery({
    queryKey: [...queryKeys.mitreExplorer, "recommendation"],
    queryFn: () => getRecommendedScenario(),
  });

  const r = query.data;
  const recommendation: LearningRecommendation | undefined = r
    ? {
        weakTactic: r.tacticName,
        mastery: r.percent,
        scenarioId: r.scenarioId,
        scenarioTitle: r.scenarioTitle,
        reason: `${r.tacticName} is your lowest-mastery tactic at ${r.percent}% (${r.hitCount}/${r.requiredCount} required techniques tagged).`,
      }
    : undefined;

  return { recommendation, isPending: query.isPending };
}
