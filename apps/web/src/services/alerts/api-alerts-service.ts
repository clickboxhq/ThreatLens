import { apiClient } from "@/lib/api-client";
import type { AlertsService } from "./alerts-service";
import type { AlertDto } from "@/types/socverse-operations";

export const apiAlertsService: AlertsService = {
  list: (sessionId, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.severity) params.set("severity", filters.severity);
    if (filters.status) params.set("status", filters.status);
    const query = params.toString();
    return apiClient.get<AlertDto[]>(`/sessions/${sessionId}/alerts${query ? `?${query}` : ""}`);
  },

  updateStatus: (sessionId, alertId, input) =>
    apiClient.patch<AlertDto>(`/sessions/${sessionId}/alerts/${alertId}`, input),
};
