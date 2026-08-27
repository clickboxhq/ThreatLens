import type {
  ScenarioEventSource,
  ScenarioDraftEvent,
  ScenarioConfigRow,
} from "@/types/scenario-builder";

export interface ScenarioBuilderService {
  listEventSources(): Promise<ScenarioEventSource[]>;
  listDraftTimeline(): Promise<ScenarioDraftEvent[]>;
  listConfig(): Promise<ScenarioConfigRow[]>;
  listValidationMessages(): Promise<string[]>;
}
