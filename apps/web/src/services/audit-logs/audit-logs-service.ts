import type { AuditLogEntryDto } from "@/types/socverse-learning";

/** platform_admin-only on the backend (RolesGuard) — see app-shell.tsx's nav gating. */
export interface AuditLogsService {
  list(filters?: {
    actorUserId?: string;
    action?: string;
    from?: string;
    to?: string;
  }): Promise<AuditLogEntryDto[]>;
}
