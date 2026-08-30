import { useQuery } from "@tanstack/react-query";
import { identitiesService } from "@/services/identities";

const keys = {
  list: (sessionId: string) => ["session", sessionId, "identities"] as const,
  profile: (sessionId: string, identityId: string) =>
    ["session", sessionId, "identities", identityId] as const,
  signIns: (sessionId: string, identityId: string) =>
    ["session", sessionId, "identities", identityId, "signins"] as const,
  audit: (sessionId: string, identityId: string) =>
    ["session", sessionId, "identities", identityId, "audit-events"] as const,
  insights: (sessionId: string, identityId: string) =>
    ["session", sessionId, "identities", identityId, "insights"] as const,
  cloudEvents: (sessionId: string, identityId: string) =>
    ["session", sessionId, "identities", identityId, "cloud-events"] as const,
};

export function useIdentities(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionId ? keys.list(sessionId) : ["identities", "none"],
    queryFn: () => identitiesService.list(sessionId!),
    enabled: Boolean(sessionId),
  });
}

export function useIdentityProfile(sessionId: string, identityId: string | null) {
  return useQuery({
    queryKey: identityId ? keys.profile(sessionId, identityId) : ["identity", "none"],
    queryFn: () => identitiesService.getProfile(sessionId, identityId!),
    enabled: Boolean(identityId),
  });
}

export function useIdentitySignIns(sessionId: string | undefined, identityId: string | undefined) {
  return useQuery({
    queryKey: sessionId && identityId ? keys.signIns(sessionId, identityId) : ["signins", "none"],
    queryFn: () => identitiesService.getSignIns(sessionId!, identityId!),
    enabled: Boolean(sessionId && identityId),
  });
}

export function useIdentityCloudEvents(sessionId: string, identityId: string | null) {
  return useQuery({
    queryKey: identityId ? keys.cloudEvents(sessionId, identityId) : ["cloud-events", "none"],
    queryFn: () => identitiesService.getCloudEvents(sessionId, identityId!),
    enabled: Boolean(identityId),
  });
}

/** Directory audit trail for one identity — the control-plane counterpart to its sign-ins. */
export function useIdentityAuditEvents(
  sessionId: string | undefined,
  identityId: string | undefined,
) {
  return useQuery({
    queryKey:
      sessionId && identityId ? keys.audit(sessionId, identityId) : ["audit-events", "none"],
    queryFn: () => identitiesService.getAuditEvents(sessionId!, identityId!),
    enabled: Boolean(sessionId && identityId),
  });
}

/** Analyst questions for this identity — see components/soc/insight-prompts.tsx. */
export function useIdentityInsights(sessionId: string | undefined, identityId: string | undefined) {
  return useQuery({
    queryKey: sessionId && identityId ? keys.insights(sessionId, identityId) : ["insights", "none"],
    queryFn: () => identitiesService.getInsights(sessionId!, identityId!),
    enabled: Boolean(sessionId && identityId),
  });
}
