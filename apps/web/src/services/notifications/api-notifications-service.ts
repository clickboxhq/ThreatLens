import { NotConnectedError } from "@/services/shared/not-connected-error";
import type { NotificationsService } from "./notifications-service";

const notConnected = (method: string): never => {
  throw new NotConnectedError(`NotificationsService.${method}`);
};

export const apiNotificationsService: NotificationsService = {
  listNotifications: () => notConnected("listNotifications"),
  markAsRead: () => notConnected("markAsRead"),
  markAllAsRead: () => notConnected("markAllAsRead"),
};
