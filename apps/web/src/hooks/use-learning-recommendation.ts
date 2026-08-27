import { useQuery } from "@tanstack/react-query";
import { mitreExplorerService } from "@/services/mitre-explorer";
import { scenariosService } from "@/services/scenarios";
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
 * Deterministic derivation (no AI): lowest-mastery MITRE tactic ->
 * the scenario library entry whose technique list covers that tactic
 * the most. Composes three already-fetched domains rather than adding
 * a new data source.
 */
export function useLearningRecommendation() {
  const query = useQuery({
    queryKey: [...queryKeys.mitreExplorer, "recommendation"],
    queryFn: async (): Promise<LearningRecommendation | undefined> => {
      const [mastery, scenarios, techniques] = await Promise.all([
        mitreExplorerService.listMastery(),
        scenariosService.listScenarios(),
        Promise.resolve(investigationsService.listMitreTechniques()),
      ]);
      if (mastery.length === 0 || scenarios.length === 0) return undefined;

      const weakest = [...mastery].sort((a, b) => a.mastery - b.mastery)[0];

      let best = scenarios[0];
      let bestOverlap = -1;
      for (const s of scenarios) {
        // t.id is now a real database UUID (apps/api's GET /mitre-techniques), not the
        // human-readable technique id — match against t.techniqueId instead, same field
        // scenarios' own `mitre` list already uses ("T1078", etc.).
        const overlap = s.mitre.filter((id) =>
          techniques.some((t) => t.techniqueId.startsWith(id) && t.tactic === weakest.tactic),
        ).length;
        if (overlap > bestOverlap) {
          best = s;
          bestOverlap = overlap;
        }
      }

      return {
        weakTactic: weakest.tactic,
        mastery: weakest.mastery,
        scenarioId: best.id,
        scenarioTitle: best.title,
        reason: `${weakest.tactic} is your lowest-mastery tactic at ${weakest.mastery}% (${weakest.practiced}/${weakest.total} techniques practiced).`,
      };
    },
  });

  return { recommendation: query.data, isPending: query.isPending };
}
