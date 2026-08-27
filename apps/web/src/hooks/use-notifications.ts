import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsService } from "@/services/notifications";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useNotifications() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => notificationsService.listNotifications(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications });

  const markAsRead = useMutation({
    mutationFn: (id: string) => notificationsService.markAsRead(id),
    onSuccess: invalidate,
  });
  const markAllAsRead = useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    onSuccess: invalidate,
  });

  const notifications = query.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    state: deriveViewState(query),
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
  };
}
