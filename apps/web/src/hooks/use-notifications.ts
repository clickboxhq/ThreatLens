import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsService } from "@/services/notifications";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";

export function useNotifications() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => notificationsService.listNotifications(),
    // Notifications arrive from background jobs (scoring, cert issuance) the viewer isn't
    // actively triggering — a light poll keeps the bell badge honest without real-time infra.
    refetchInterval: 30_000,
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
