import type {
  AssignedScenarioDto,
  OrganizationScenarioDto,
} from "@/types/threatlens-organization-scenarios";

export interface OrganizationScenariosService {
  /** org_admin: the org's scenario collection. */
  listOrgScenarios(): Promise<OrganizationScenarioDto[]>;
  /** org_admin: bulk-add — one call for however many scenarios were multi-selected. */
  addScenarios(scenarioIds: string[]): Promise<OrganizationScenarioDto[]>;
  /** org_admin: set (or clear, with null) the due date for one org scenario. */
  updateDueDate(id: string, dueAt: string | null): Promise<OrganizationScenarioDto>;
  /** org_admin: remove from the org's collection. Never deletes the global scenario. */
  removeScenario(id: string): Promise<void>;
  /** Any active org member: their own assigned scenarios. */
  listMyAssignedScenarios(): Promise<AssignedScenarioDto[]>;
}
