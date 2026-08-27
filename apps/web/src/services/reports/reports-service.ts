import type { ReportItem } from "@/types/reports";

export interface ReportsService {
  listReports(): Promise<ReportItem[]>;
}
