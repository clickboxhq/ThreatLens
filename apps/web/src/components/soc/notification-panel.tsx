import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  Award,
  Bell,
  Building2,
  ClipboardCheck,
  Megaphone,
  MessageSquare,
  Target,
} from "lucide-react";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { EmptyState, Skeleton } from "@/components/soc/ui/skeleton";
import { useNotifications } from "@/hooks/use-notifications";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { NotificationCategory } from "@/types/notifications";

const categoryIcon: Record<NotificationCategory, typeof Bell> = {
  assignment: ClipboardCheck,
  score_available: Target,
  instructor_feedback: MessageSquare,
  certificate_issued: Award,
  announcement: Megaphone,
  org_invitation: Building2,
};

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { notifications, state, markAsRead, markAllAsRead } = useNotifications();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-30 mt-2 w-[360px] overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
        <h3 className="text-[13px] font-medium">Notifications</h3>
        <button
          onClick={() => markAllAsRead()}
          className="text-[11.5px] text-secondary hover:text-foreground"
        >
          Mark all read
        </button>
      </div>

      {state === "loading" && (
        <div className="flex flex-col gap-2 p-3">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      )}

      {state === "empty" && (
        <div className="p-2">
          <EmptyState
            title="No notifications"
            description="You're all caught up."
            icon={<Bell className="size-5" />}
          />
        </div>
      )}

      {state === "ready" && (
        <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
          {notifications.map((n) => {
            // Fall back to a generic bell rather than rendering `undefined` (which throws
            // "Element type is invalid" and takes the whole panel down) for any category
            // this build doesn't recognise yet.
            const Icon = categoryIcon[n.category] ?? Bell;
            const content = (
              <div className="flex items-start gap-2.5 px-3.5 py-3">
                <IconTile tone={n.read ? "neutral" : "info"} size="sm">
                  <Icon className="size-3.5" />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {!n.read && (
                      <span className="size-1.5 shrink-0 rounded-full bg-[color:var(--info)]" />
                    )}
                    <span className="truncate text-[12.5px] font-medium">{n.title}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11.5px] text-secondary">{n.body}</p>
                  <div className="mt-1 text-[10.5px] text-muted-foreground">
                    {formatRelativeTime(n.createdAt)}
                  </div>
                </div>
              </div>
            );
            return (
              <li key={n.id} className="transition-colors hover:bg-background/60">
                {n.link ? (
                  <Link
                    to={n.link}
                    onClick={() => {
                      markAsRead(n.id);
                      onClose();
                    }}
                  >
                    {content}
                  </Link>
                ) : (
                  <button className="w-full text-left" onClick={() => markAsRead(n.id)}>
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
