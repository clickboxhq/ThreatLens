import type { Scenario } from "@/types/scenarios";

export interface ScenariosService {
  listScenarios(): Scenario[];
  getProgress(id: string): number | undefined;
  setProgress(id: string, pct: number): void;
}
