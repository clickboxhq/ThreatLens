import { useQuery } from "@tanstack/react-query";
import { emailInvestigationsService } from "@/services/email-investigations";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useEmailInvestigations() {
  const query = useQuery({
    queryKey: [...queryKeys.emailInvestigations, "messages"],
    queryFn: () => emailInvestigationsService.listMessages(),
  });
  return { ...query, messages: query.data ?? [], state: deriveViewState(query) };
}
