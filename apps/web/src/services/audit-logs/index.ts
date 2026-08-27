import type { AuditLogsService } from "./audit-logs-service";
import { mockAuditLogsService } from "./mock-audit-logs-service";

export const auditLogsService: AuditLogsService = mockAuditLogsService;
export type { AuditLogsService } from "./audit-logs-service";
