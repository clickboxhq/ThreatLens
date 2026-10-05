import { apiClient } from "@/lib/api-client";
import type { OrganizationScenariosService } from "./organization-scenarios-service";
import type {
  AssignedScenarioDto,
  OrganizationScenarioDto,
} from "@/types/threatlens-organization-scenarios";

export const apiOrganizationScenariosService: OrganizationScenariosService = {
  listOrgScenarios: () => apiClient.get<OrganizationScenarioDto[]>("/organizations/mine/scenarios"),

  addScenarios: (scenarioIds) =>
    apiClient.post<OrganizationScenarioDto[]>("/organizations/mine/scenarios", {
      scenarioIds,
    }),

  updateDueDate: (id, dueAt) =>
    apiClient.patch<OrganizationScenarioDto>(
      `/organizations/mine/scenarios/${encodeURIComponent(id)}`,
      { dueAt },
    ),

  removeScenario: async (id) => {
    await apiClient.delete(`/organizations/mine/scenarios/${encodeURIComponent(id)}`);
  },

  listMyAssignedScenarios: () => apiClient.get<AssignedScenarioDto[]>("/assigned-scenarios/mine"),
};
