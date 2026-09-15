import type { Notification } from "@/types/notifications";

export interface NotificationsService {
  listNotifications(): Promise<Notification[]>;
  markAsRead(id: string): Promise<void>;
  markAllAsRead(): Promise<void>;
  /** Clears one of the caller's own notifications. */
  clear(id: string): Promise<void>;
  /** Clears every one of the caller's own notifications. */
  clearAll(): Promise<void>;
}
