import { apiClient } from "@/lib/api-client";
import type { ReportsService } from "./reports-service";
import type { ReportListItem, IncidentReport } from "@/types/reports";

export const apiReportsService: ReportsService = {
  listMine: () => apiClient.get<ReportListItem[]>("/reports/mine"),
  getReport: (sessionId, incidentId) =>
    apiClient.get<IncidentReport>(`/sessions/${sessionId}/incidents/${incidentId}/report`),
};
