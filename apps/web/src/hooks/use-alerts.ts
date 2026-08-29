import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { alertsService } from "@/services/alerts";
import type { AlertStatus } from "@/types/socverse-operations";

const keys = {
  list: (sessionId: string) => ["session", sessionId, "alerts"] as const,
  evidence: (sessionId: string, alertId: string) =>
    ["session", sessionId, "alerts", alertId, "evidence"] as const,
};

export function useAlerts(sessionId: string | undefined) {
  return useQuery({
    queryKey: sessionId ? keys.list(sessionId) : ["alerts", "none"],
    queryFn: () => alertsService.list(sessionId!),
    enabled: Boolean(sessionId),
  });
}

export function useUpdateAlertStatus(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      alertId,
      ...body
    }: {
      alertId: string;
      status: AlertStatus;
      dismissalReason?: string;
    }) => alertsService.updateStatus(sessionId!, alertId, body),
    onSuccess: () => {
      if (sessionId) queryClient.invalidateQueries({ queryKey: keys.list(sessionId) });
    },
  });
}

/**
 * The telemetry a detection actually fired on. The endpoint has existed since the alert engine
 * was built and nothing ever called it, so the queue could tell a learner *that* something was
 * suspicious but never *what* the rule saw — which is the first thing an analyst asks and the
 * hardest thing to guess when you are still learning.
 */
export function useAlertEvidence(sessionId: string | undefined, alertId: string | null) {
  return useQuery({
    queryKey: sessionId && alertId ? keys.evidence(sessionId, alertId) : ["alert-evidence", "none"],
    queryFn: () => alertsService.getEvidence(sessionId!, alertId!),
    enabled: Boolean(sessionId && alertId),
  });
}
