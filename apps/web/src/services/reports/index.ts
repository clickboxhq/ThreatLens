import type { ReportsService } from "./reports-service";
import { mockReportsService } from "./mock-reports-service";

export const reportsService: ReportsService = mockReportsService;
export type { ReportsService } from "./reports-service";
