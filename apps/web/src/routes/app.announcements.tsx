import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Megaphone, Send, Users } from "lucide-react";
import { Panel, SectionHeader } from "@/components/soc/primitives";
import { Skeleton, EmptyState } from "@/components/soc/ui/skeleton";
import { IconTile } from "@/components/soc/ui/icon-tile";
import {
  useMyAnnouncements,
  useSentAnnouncements,
  useCreateAnnouncement,
} from "@/hooks/use-organizations";
import { useOwnedCohorts } from "@/hooks/use-instructor";
import { useAuthUser } from "@/lib/auth-store";
import { ApiError } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { AnnouncementDto } from "@/types/threatlens-organizations";

export const Route = createFileRoute("/app/announcements")({
  component: AnnouncementsPage,
  head: () => ({ meta: [{ title: "ThreatLens · Announcements" }] }),
});

const TITLE_MAX = 160;
const BODY_MAX = 4000;

function AnnouncementsPage() {
  const me = useAuthUser();
  const isOrgAdmin = me?.role === "org_admin";

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Announcements"
        description={
          isOrgAdmin
            ? "Send a message to everyone in your organization, or to one cohort."
            : "Messages from your organization."
        }
      />
      {isOrgAdmin ? <AdminView /> : <ReceivedFeed />}
    </div>
  );
}

function AdminView() {
  const cohortsQuery = useOwnedCohorts();
  const create = useCreateAnnouncement();
  const { announcements: sent, isPending: sentPending } = useSentAnnouncements(true);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cohortId, setCohortId] = useState("");

  const cohorts = useMemo(
    () => (cohortsQuery.data ?? []).filter((c) => !c.archivedAt),
    [cohortsQuery.data],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    create.mutate(
      { title: title.trim(), body: body.trim(), cohortId: cohortId || undefined },
      {
        onSuccess: (a) => {
          toast.success(
            a.recipientCount === 0
              ? "Announcement sent (no recipients matched)."
              : `Announcement sent to ${a.recipientCount} ${
                  a.recipientCount === 1 ? "person" : "people"
                }.`,
          );
          setTitle("");
          setBody("");
          setCohortId("");
        },
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Couldn't send that announcement."),
      },
    );
  };

  return (
    <>
      <Panel title="New announcement">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Title
            </span>
            <input
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Maintenance window this Saturday"
              className="h-9 rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Message
            </span>
            <textarea
              value={body}
              maxLength={BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Write the announcement…"
              className="resize-y rounded-md border border-border bg-background px-3 py-2 text-[13px] leading-relaxed focus:outline-none"
            />
            <span className="self-end text-[10.5px] text-muted-foreground">
              {body.length}/{BODY_MAX}
            </span>
          </label>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Send to
              </span>
              <select
                value={cohortId}
                onChange={(e) => setCohortId(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none"
              >
                <option value="">Everyone in the organization</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    Cohort: {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={create.isPending || !title.trim() || !body.trim()}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              <Send className="size-3.5" />
              {create.isPending ? "Sending…" : "Send announcement"}
            </button>
          </div>
        </form>
      </Panel>

      <Panel title="Sent" padded={false} className="mt-4">
        {sentPending ? (
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : sent.length === 0 ? (
          <EmptyState
            title="Nothing sent yet"
            description="Your organization's announcements will appear here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {sent.map((a) => (
              <AnnouncementRow key={a.id} announcement={a} showAudience />
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function ReceivedFeed() {
  const { announcements, isPending, isError } = useMyAnnouncements();

  if (isPending) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }
  if (isError) {
    return <EmptyState title="Couldn't load announcements" description="Try reloading the page." />;
  }
  if (announcements.length === 0) {
    return (
      <EmptyState
        title="No announcements"
        description="Messages from your organization will show up here."
        icon={<Megaphone className="size-5" />}
      />
    );
  }
  return (
    <Panel padded={false}>
      <ul className="divide-y divide-border">
        {announcements.map((a) => (
          <AnnouncementRow key={a.id} announcement={a} />
        ))}
      </ul>
    </Panel>
  );
}

function AnnouncementRow({
  announcement,
  showAudience = false,
}: {
  announcement: AnnouncementDto;
  showAudience?: boolean;
}) {
  const audienceLabel =
    announcement.audience.scope === "cohort"
      ? `Cohort · ${announcement.audience.cohortName}`
      : "Whole organization";

  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      <IconTile tone="info" size="sm">
        <Megaphone className="size-3.5" />
      </IconTile>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{announcement.title}</div>
        <p className="mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-secondary">
          {announcement.body}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-muted-foreground">
          <span>{announcement.authorName}</span>
          <span>·</span>
          <span>{formatRelativeTime(announcement.createdAt)}</span>
          {showAudience && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-3" />
                {audienceLabel} ({announcement.recipientCount})
              </span>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
