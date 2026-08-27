import { useSoc } from "@/lib/store";
import type { AlertsService } from "./alerts-service";

export const mockAlertsService: AlertsService = {
  listAlerts: () => useSoc.getState().alerts,
  setAlertStatus: (id, status) => useSoc.getState().setAlertStatus(id, status),
  assignAlert: (id, analyst) => useSoc.getState().assignAlert(id, analyst),
  resolveAlert: (id) => useSoc.getState().resolveAlert(id),
  escalateAlert: (id) => useSoc.getState().escalateAlert(id),
  addAlertNote: (id, note) => useSoc.getState().addAlertNote(id, note),
  dismissAlert: (id, reason) => useSoc.getState().dismissAlert(id, reason),
  promoteAlert: (id, incidentId) => useSoc.getState().promoteAlert(id, incidentId),
};
