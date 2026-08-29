import { useQuery } from "@tanstack/react-query";
import { reportsService } from "@/services/reports";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useReports() {
  const query = useQuery({
    queryKey: [...queryKeys.reports, "mine"],
    queryFn: () => reportsService.listMine(),
  });
  return { reports: query.data ?? [], state: deriveViewState(query) };
}

export function useReport(sessionId: string, incidentId: string) {
  const query = useQuery({
    queryKey: [...queryKeys.reports, sessionId, incidentId],
    queryFn: () => reportsService.getReport(sessionId, incidentId),
  });
  return { report: query.data, isPending: query.isPending, isError: query.isError };
}
