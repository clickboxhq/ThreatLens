import {
  trainingKpis,
  investigationPerformance,
  recentInvestigations,
  assignedScenarios,
} from "@/lib/soc-data";
import type { DashboardPerformanceService } from "./dashboard-performance-service";

export const mockDashboardPerformanceService: DashboardPerformanceService = {
  listKpis: () => Promise.resolve(trainingKpis),
  listPerformance: () => Promise.resolve(investigationPerformance),
  listRecentInvestigations: () => Promise.resolve(recentInvestigations),
  listAssignedScenarios: () => Promise.resolve(assignedScenarios),
};
