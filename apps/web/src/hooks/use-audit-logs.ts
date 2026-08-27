import { useQuery } from "@tanstack/react-query";
import { auditLogsService } from "@/services/audit-logs";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useAuditLogs() {
  const entriesQuery = useQuery({
    queryKey: [...queryKeys.auditLogs, "entries"],
    queryFn: () => auditLogsService.listEntries(),
  });
  const statsQuery = useQuery({
    queryKey: [...queryKeys.auditLogs, "stats"],
    queryFn: () => auditLogsService.getStats(),
  });
  const categoriesQuery = useQuery({
    queryKey: [...queryKeys.auditLogs, "categories"],
    queryFn: () => auditLogsService.listCategories(),
  });
  return {
    entries: entriesQuery.data ?? [],
    stats: statsQuery.data,
    categories: categoriesQuery.data ?? [],
    state: deriveViewState(entriesQuery),
  };
}
