import type { DashboardPerformanceService } from "./dashboard-performance-service";
import { mockDashboardPerformanceService } from "./mock-dashboard-performance-service";

export const dashboardPerformanceService: DashboardPerformanceService =
  mockDashboardPerformanceService;
export type { DashboardPerformanceService } from "./dashboard-performance-service";
