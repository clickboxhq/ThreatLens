import { useQuery } from "@tanstack/react-query";
import { emailInvestigationsService } from "@/services/email-investigations";

const keys = {
  list: (sessionId: string) => ["session", sessionId, "emails"] as const,
};

export function useEmailInvestigations(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionId ? keys.list(sessionId) : ["emails", "none"],
    queryFn: () => emailInvestigationsService.list(sessionId!),
    enabled: Boolean(sessionId),
  });
}
