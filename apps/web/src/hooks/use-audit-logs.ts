import { useQuery } from "@tanstack/react-query";
import { auditLogsService } from "@/services/audit-logs";

export function useAuditLogs() {
  const query = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => auditLogsService.list(),
    retry: false, // a 403 (non-admin) or 404 won't resolve on retry
  });
  return {
    entries: query.data ?? [],
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
  };
}
