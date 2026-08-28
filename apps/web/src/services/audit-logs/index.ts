import { apiAuditLogsService } from "./api-audit-logs-service";
import type { AuditLogsService } from "./audit-logs-service";

export const auditLogsService: AuditLogsService = apiAuditLogsService;

export type { AuditLogsService } from "./audit-logs-service";
