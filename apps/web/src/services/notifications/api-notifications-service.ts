import { apiClient } from "@/lib/api-client";
import type { NotificationsService } from "./notifications-service";
import type { Notification } from "@/types/notifications";

export const apiNotificationsService: NotificationsService = {
  listNotifications: () => apiClient.get<Notification[]>("/notifications/mine"),
  markAsRead: (id) => apiClient.patch<void>(`/notifications/${id}/read`),
  markAllAsRead: () => apiClient.post<void>("/notifications/read-all"),
};
