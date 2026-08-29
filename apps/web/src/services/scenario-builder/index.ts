import type { ScenarioBuilderService } from "./scenario-builder-service";
import { apiScenarioBuilderService } from "./api-scenario-builder-service";

export const scenarioBuilderService: ScenarioBuilderService = apiScenarioBuilderService;
export type { ScenarioBuilderService } from "./scenario-builder-service";
