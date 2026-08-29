import { apiReportsService } from "./api-reports-service";
import type { ReportsService } from "./reports-service";

export const reportsService: ReportsService = apiReportsService;
export type { ReportsService } from "./reports-service";
