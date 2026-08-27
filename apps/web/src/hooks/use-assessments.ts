import { useQuery } from "@tanstack/react-query";
import { assessmentsService } from "@/services/assessments";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useAssessments() {
  const rowsQuery = useQuery({
    queryKey: [...queryKeys.assessments, "list"],
    queryFn: () => assessmentsService.listAssessments(),
  });
  const statsQuery = useQuery({
    queryKey: [...queryKeys.assessments, "stats"],
    queryFn: () => assessmentsService.getStats(),
  });
  const breakdownQuery = useQuery({
    queryKey: [...queryKeys.assessments, "grading-breakdown"],
    queryFn: () => assessmentsService.listGradingBreakdown(),
  });
  return {
    rows: rowsQuery.data ?? [],
    stats: statsQuery.data,
    gradingBreakdown: breakdownQuery.data ?? [],
    state: deriveViewState(rowsQuery),
  };
}
