import type {
  EventTemplateDto,
  ScenarioDraft,
  CreatedScenarioDto,
} from "@/types/socverse-scenario-builder";

export interface ScenarioBuilderService {
  listTemplates(): Promise<EventTemplateDto[]>;
  validateDraft(draft: ScenarioDraft): Promise<{ valid: boolean; errors: string[] }>;
  publishDraft(draft: ScenarioDraft): Promise<CreatedScenarioDto>;
}
