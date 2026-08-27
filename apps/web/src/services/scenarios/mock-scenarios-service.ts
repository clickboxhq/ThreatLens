import { useSoc } from "@/lib/store";
import type { ScenariosService } from "./scenarios-service";

export const mockScenariosService: ScenariosService = {
  listScenarios: () => useSoc.getState().scenarios,
  getProgress: (id) => useSoc.getState().scenarioProgress[id],
  setProgress: (id, pct) => useSoc.getState().setScenarioProgress(id, pct),
};
