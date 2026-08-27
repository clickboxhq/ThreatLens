import type { AlertsService } from "./alerts-service";
import { mockAlertsService } from "./mock-alerts-service";

export const alertsService: AlertsService = mockAlertsService;
export type { AlertsService } from "./alerts-service";
