import type { NotificationsService } from "./notifications-service";
import { mockNotificationsService } from "./mock-notifications-service";

export const notificationsService: NotificationsService = mockNotificationsService;
export type { NotificationsService } from "./notifications-service";
