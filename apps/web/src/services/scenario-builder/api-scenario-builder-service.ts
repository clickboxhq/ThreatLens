import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { ScenarioBuilderService } from "./scenario-builder-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`ScenarioBuilderService.${method}`);
};

export const apiScenarioBuilderService: ScenarioBuilderService = {
  listEventSources: () => notConnected("listEventSources"),
  listDraftTimeline: () => notConnected("listDraftTimeline"),
  listConfig: () => notConnected("listConfig"),
  listValidationMessages: () => notConnected("listValidationMessages"),
};
