import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Award,
  Bell,
  Building2,
  ClipboardCheck,
  Megaphone,
  MessageSquare,
  Target,
  Users,
  X,
} from "lucide-react";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { useNotifications } from "@/hooks/use-notifications";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { NotificationCategory } from "@/types/notifications";

export const Route = createFileRoute("/app/notifications")({
  component: Notifications,
  head: () => ({
    meta: [
      { title: "ThreatLens · Notifications" },
      { name: "description", content: "Every notification across your ThreatLens account." },
    ],
  }),
});

const categoryIcon: Record<NotificationCategory, typeof Bell> = {
  assignment: ClipboardCheck,
  score_available: Target,
  instructor_feedback: MessageSquare,
  certificate_issued: Award,
  announcement: Megaphone,
  org_invitation: Building2,
  cohort_invitation: Users,
};

function Notifications() {
  const { notifications, state, markAsRead, markAllAsRead, clear, clearAll } = useNotifications();

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Notifications"
        description="Everything ThreatLens has sent you — assignments, scores, announcements, and more."
        actions={
          notifications.length > 0 ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => markAllAsRead()}
                className="text-[12px] text-secondary hover:text-foreground"
              >
                Mark all read
              </button>
              <button
                onClick={() => clearAll()}
                className="text-[12px] text-secondary hover:text-[color:var(--critical)]"
              >
                Clear all
              </button>
            </div>
          ) : undefined
        }
      />

      {state === "loading" ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : state === "error" ? (
        <EmptyState
          title="Couldn't load your notifications"
          description="Try reloading the page."
        />
      ) : state === "empty" ? (
        <EmptyState
          title="No notifications"
          description="You're all caught up."
          icon={<Bell className="size-5" />}
        />
      ) : (
        <Panel padded={false}>
          <ul className="divide-y divide-border">
            {notifications.map((n) => {
              // Fall back to a generic bell rather than rendering `undefined` (which throws
              // "Element type is invalid" and takes the whole page down) if the API ever sends
              // a category this build doesn't know yet — same guard as the header dropdown.
              const Icon = categoryIcon[n.category] ?? Bell;
              const content = (
                <div className="flex items-start gap-3 px-4 py-3.5">
                  <IconTile tone={n.read ? "neutral" : "info"} size="sm">
                    <Icon className="size-4" />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {!n.read && (
                        <span className="size-1.5 shrink-0 rounded-full bg-[color:var(--info)]" />
                      )}
                      <span className="truncate text-[13px] font-medium">{n.title}</span>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-secondary">{n.body}</p>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {formatRelativeTime(n.createdAt)}
                    </div>
                  </div>
                </div>
              );
              return (
                <li key={n.id} className="group relative transition-colors hover:bg-background/40">
                  {n.link ? (
                    <Link to={n.link} onClick={() => markAsRead(n.id)}>
                      {content}
                    </Link>
                  ) : (
                    <button className="w-full text-left" onClick={() => markAsRead(n.id)}>
                      {content}
                    </button>
                  )}
                  <button
                    aria-label="Clear notification"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      clear(n.id);
                    }}
                    className="absolute right-3 top-3.5 rounded p-1 text-muted-foreground opacity-0 hover:text-[color:var(--critical)] group-hover:opacity-100"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}
