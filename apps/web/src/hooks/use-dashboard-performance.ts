import { useQuery } from "@tanstack/react-query";
import { dashboardPerformanceService } from "@/services/dashboard-performance";
import { leaderboardService } from "@/services/leaderboard";
import { mitreExplorerService } from "@/services/mitre-explorer";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useDashboardPerformance() {
  const kpisQuery = useQuery({
    queryKey: [...queryKeys.dashboardPerformance, "kpis"],
    queryFn: () => dashboardPerformanceService.listKpis(),
  });
  const performanceQuery = useQuery({
    queryKey: [...queryKeys.dashboardPerformance, "performance"],
    queryFn: () => dashboardPerformanceService.listPerformance(),
  });
  const recentQuery = useQuery({
    queryKey: [...queryKeys.dashboardPerformance, "recent"],
    queryFn: () => dashboardPerformanceService.listRecentInvestigations(),
  });
  const assignedQuery = useQuery({
    queryKey: [...queryKeys.dashboardPerformance, "assigned"],
    queryFn: () => dashboardPerformanceService.listAssignedScenarios(),
  });
  const masteryQuery = useQuery({
    queryKey: [...queryKeys.mitreExplorer, "mastery"],
    queryFn: () => mitreExplorerService.listMastery(),
  });
  const leaderboardQuery = useQuery({
    queryKey: queryKeys.leaderboard,
    queryFn: () => leaderboardService.listLeaderboard(),
  });

  return {
    kpis: kpisQuery.data ?? [],
    performance: performanceQuery.data ?? [],
    recentInvestigations: recentQuery.data ?? [],
    assignedScenarios: assignedQuery.data ?? [],
    mitreMastery: masteryQuery.data ?? [],
    leaderboard: leaderboardQuery.data ?? [],
    state: deriveViewState(kpisQuery),
  };
}
