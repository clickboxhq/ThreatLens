import { useQuery } from "@tanstack/react-query";
import { identitiesService } from "@/services/identities";

const keys = {
  list: (sessionId: string) => ["session", sessionId, "identities"] as const,
  signIns: (sessionId: string, identityId: string) =>
    ["session", sessionId, "identities", identityId, "signins"] as const,
};

export function useIdentities(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionId ? keys.list(sessionId) : ["identities", "none"],
    queryFn: () => identitiesService.list(sessionId!),
    enabled: Boolean(sessionId),
  });
}

export function useIdentitySignIns(sessionId: string | undefined, identityId: string | undefined) {
  return useQuery({
    queryKey: sessionId && identityId ? keys.signIns(sessionId, identityId) : ["signins", "none"],
    queryFn: () => identitiesService.getSignIns(sessionId!, identityId!),
    enabled: Boolean(sessionId && identityId),
  });
}
