import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { alertsService } from "@/services/alerts";
import type { AlertStatus } from "@/types/socverse-operations";

const keys = {
  list: (sessionId: string) => ["session", sessionId, "alerts"] as const,
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
