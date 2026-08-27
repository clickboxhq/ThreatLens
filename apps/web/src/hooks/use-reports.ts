import { useQuery } from "@tanstack/react-query";
import { reportsService } from "@/services/reports";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useReports() {
  const query = useQuery({
    queryKey: queryKeys.reports,
    queryFn: () => reportsService.listReports(),
  });
  return { ...query, reports: query.data ?? [], state: deriveViewState(query) };
}
