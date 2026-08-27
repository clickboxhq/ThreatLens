import type { Notification } from "@/types/notifications";

export interface NotificationsService {
  listNotifications(): Promise<Notification[]>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(): Promise<void>;
}
