import { useQuery } from "@tanstack/react-query";
import { networkService } from "@/services/network";

const keys = {
  list: (sessionId: string) => ["session", sessionId, "network"] as const,
};

export function useSessionNetwork(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionId ? keys.list(sessionId) : ["network", "none"],
    queryFn: () => networkService.list(sessionId!),
    enabled: Boolean(sessionId),
  });
}
