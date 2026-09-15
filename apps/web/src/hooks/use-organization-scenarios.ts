import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { organizationScenariosService } from "@/services/organization-scenarios";

const keys = {
  orgScenarios: ["organizations", "mine", "scenarios"] as const,
  myAssigned: ["assigned-scenarios", "mine"] as const,
};

/** org_admin: the org's scenario-management table. */
export function useOrganizationScenarios(enabled: boolean) {
  const query = useQuery({
    queryKey: keys.orgScenarios,
    queryFn: () => organizationScenariosService.listOrgScenarios(),
    enabled,
  });
  return { scenarios: query.data ?? [], isPending: query.isPending, isError: query.isError };
}

export function useAddOrganizationScenarios() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scenarioIds: string[]) => organizationScenariosService.addScenarios(scenarioIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.orgScenarios });
    },
  });
}

export function useUpdateOrganizationScenarioDueDate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dueAt }: { id: string; dueAt: string | null }) =>
      organizationScenariosService.updateDueDate(id, dueAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.orgScenarios });
    },
  });
}

export function useRemoveOrganizationScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => organizationScenariosService.removeScenario(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.orgScenarios });
    },
  });
}

/** Any active org member: their own Assigned Scenarios. */
export function useMyAssignedScenarios(enabled: boolean) {
  const query = useQuery({
    queryKey: keys.myAssigned,
    queryFn: () => organizationScenariosService.listMyAssignedScenarios(),
    enabled,
  });
  return {
    assignments: query.data ?? [],
    isPending: query.isPending,
    isError: query.isError,
  };
}
