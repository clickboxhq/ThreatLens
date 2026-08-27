import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { AlertsService } from "./alerts-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`AlertsService.${method}`);
};

export const apiAlertsService: AlertsService = {
  listAlerts: () => notConnected("listAlerts"),
  setAlertStatus: () => notConnected("setAlertStatus"),
  assignAlert: () => notConnected("assignAlert"),
  resolveAlert: () => notConnected("resolveAlert"),
  escalateAlert: () => notConnected("escalateAlert"),
  addAlertNote: () => notConnected("addAlertNote"),
  dismissAlert: () => notConnected("dismissAlert"),
  promoteAlert: () => notConnected("promoteAlert"),
};
