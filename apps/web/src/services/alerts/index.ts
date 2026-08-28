import { apiAlertsService } from "./api-alerts-service";
import type { AlertsService } from "./alerts-service";

export const alertsService: AlertsService = apiAlertsService;

export type { AlertsService } from "./alerts-service";
