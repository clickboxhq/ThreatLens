import { apiClient } from "@/lib/api-client";
import type { AuditLogsService } from "./audit-logs-service";
import type { AuditLogEntryDto } from "@/types/threatlens-learning";

export const apiAuditLogsService: AuditLogsService = {
  list: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.actorUserId) params.set("actorUserId", filters.actorUserId);
    if (filters.action) params.set("action", filters.action);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    const query = params.toString();
    return apiClient.get<AuditLogEntryDto[]>(`/admin/audit-logs${query ? `?${query}` : ""}`);
  },
};
