import type { NotificationsService } from "./notifications-service";
import { apiNotificationsService } from "./api-notifications-service";

export const notificationsService: NotificationsService = apiNotificationsService;
export type { NotificationsService } from "./notifications-service";
