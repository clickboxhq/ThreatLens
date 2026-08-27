import type { AuditLogEntry, AuditLogStats, AuditLogCategory } from "@/types/audit-logs";

export interface AuditLogsService {
  listEntries(): Promise<AuditLogEntry[]>;
  getStats(): Promise<AuditLogStats>;
  listCategories(): Promise<AuditLogCategory[]>;
}
