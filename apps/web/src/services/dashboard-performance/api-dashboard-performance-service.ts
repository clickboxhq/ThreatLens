import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { DashboardPerformanceService } from "./dashboard-performance-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`DashboardPerformanceService.${method}`);
};

export const apiDashboardPerformanceService: DashboardPerformanceService = {
  listKpis: () => notConnected("listKpis"),
  listPerformance: () => notConnected("listPerformance"),
  listRecentInvestigations: () => notConnected("listRecentInvestigations"),
  listAssignedScenarios: () => notConnected("listAssignedScenarios"),
};
