import { useQuery } from "@tanstack/react-query";
import { emailInvestigationsService } from "@/services/email-investigations";

const keys = {
  list: (sessionId: string) => ["session", sessionId, "emails"] as const,
  message: (sessionId: string, messageId: string) =>
    ["session", sessionId, "emails", messageId] as const,
  similar: (sessionId: string, messageId: string) =>
    ["session", sessionId, "emails", messageId, "similar"] as const,
  linkActivity: (sessionId: string, messageId: string) =>
    ["session", sessionId, "emails", messageId, "link-activity"] as const,
};

export function useEmailInvestigations(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionId ? keys.list(sessionId) : ["emails", "none"],
    queryFn: () => emailInvestigationsService.list(sessionId!),
    enabled: Boolean(sessionId),
  });
}

/** The full message — body, headers, auth results, attachments, URLs. */
export function useEmailMessage(sessionId: string, messageId: string | null) {
  return useQuery({
    queryKey: messageId ? keys.message(sessionId, messageId) : ["email", "none"],
    queryFn: () => emailInvestigationsService.getMessage(sessionId, messageId!),
    enabled: Boolean(messageId),
  });
}

/** "Who else received this?" — other messages from the same sender domain in this session. */
export function useSimilarEmails(sessionId: string, messageId: string | null) {
  return useQuery({
    queryKey: messageId ? keys.similar(sessionId, messageId) : ["email-similar", "none"],
    queryFn: () => emailInvestigationsService.getSimilar(sessionId, messageId!),
    enabled: Boolean(messageId),
  });
}

/** "Did anyone click it?" — per-URL correlation against the session's HTTP telemetry. */
export function useEmailLinkActivity(sessionId: string, messageId: string | null) {
  return useQuery({
    queryKey: messageId ? keys.linkActivity(sessionId, messageId) : ["email-links", "none"],
    queryFn: () => emailInvestigationsService.getLinkActivity(sessionId, messageId!),
    enabled: Boolean(messageId),
  });
}
