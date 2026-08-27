import { useSoc } from "@/lib/store";
import { scenariosService } from "@/services/scenarios";

export function useScenarios() {
  const scenarios = useSoc((s) => s.scenarios);
  const scenarioProgress = useSoc((s) => s.scenarioProgress);
  return { scenarios, scenarioProgress, setProgress: scenariosService.setProgress };
}
