import type { ReportListItem, IncidentReport } from "@/types/reports";

export interface ReportsService {
  listMine(): Promise<ReportListItem[]>;
  getReport(sessionId: string, incidentId: string): Promise<IncidentReport>;
}
