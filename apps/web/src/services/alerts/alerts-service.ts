import type { AlertDto, AlertSeverity, AlertStatus } from "@/types/socverse-operations";

/** Alerts are generated per session, scoped to that session's own telemetry — see
 * socverse-operations.ts on why there's no cross-session alert feed. */
export interface AlertsService {
  list(
    sessionId: string,
    filters?: { severity?: AlertSeverity; status?: AlertStatus },
  ): Promise<AlertDto[]>;
  updateStatus(
    sessionId: string,
    alertId: string,
    input: { status: AlertStatus; dismissalReason?: string },
  ): Promise<AlertDto>;
}
