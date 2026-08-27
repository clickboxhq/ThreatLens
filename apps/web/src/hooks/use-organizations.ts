import { useQuery } from "@tanstack/react-query";
import { organizationsService } from "@/services/organizations";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useOrganizations() {
  const query = useQuery({
    queryKey: queryKeys.organizations,
    queryFn: () => organizationsService.listMembers(),
  });
  return { ...query, members: query.data ?? [], state: deriveViewState(query) };
}
