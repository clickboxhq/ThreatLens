import type {
  TrainingKpi,
  InvestigationPerformancePoint,
  RecentInvestigation,
  AssignedScenario,
} from "@/types/dashboard-performance";

export interface DashboardPerformanceService {
  listKpis(): Promise<TrainingKpi[]>;
  listPerformance(): Promise<InvestigationPerformancePoint[]>;
  listRecentInvestigations(): Promise<RecentInvestigation[]>;
  listAssignedScenarios(): Promise<AssignedScenario[]>;
}
