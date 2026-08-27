import { useSoc } from "@/lib/store";
import { alertsService } from "@/services/alerts";

/** Reactive alert list (via the store) plus the alert mutation surface. */
export function useAlerts() {
  const alerts = useSoc((s) => s.alerts);
  return {
    alerts,
    setAlertStatus: alertsService.setAlertStatus,
    assignAlert: alertsService.assignAlert,
    resolveAlert: alertsService.resolveAlert,
    escalateAlert: alertsService.escalateAlert,
    addAlertNote: alertsService.addAlertNote,
    dismissAlert: alertsService.dismissAlert,
    promoteAlert: alertsService.promoteAlert,
  };
}
