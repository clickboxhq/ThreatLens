import { sessionsService } from "@/services/sessions";
import type { MitreExplorerService } from "./mitre-explorer-service";

export const apiMitreExplorerService: MitreExplorerService = {
  listMastery: async () => {
    const entries = await sessionsService.getSkillRadar();
    return entries.map((e) => ({
      tactic: e.tacticName,
      mastery: e.percent,
      practiced: e.hitCount,
      total: e.requiredCount,
    }));
  },

  listPracticedTechniques: async () => {
    const entries = await sessionsService.getTechniqueMastery();
    return entries.map((e) => ({
      id: e.techniqueId,
      name: e.name,
      tactic: e.tacticName,
      mastery: e.percent,
      practicedCount: e.requiredCount,
    }));
  },
};
