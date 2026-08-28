import { createFileRoute, Link } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/soc/workspace-page";
import { useMySessions } from "@/hooks/use-sessions";
import { formatRelativeTime } from "@/lib/format-relative-time";

export const Route = createFileRoute("/app/incidents")({
  component: IncidentsPage,
  head: () => ({ meta: [{ title: "ThreatLens · Incidents" }] }),
});

function IncidentsPage() {
  const query = useMySessions();
  // The queue is deliberately narrower than Case Management — it's "what still needs work",
  // not the full graded history. SOCVerse opens exactly one incident per session (see the merge
  // plan), so an active session and its open incident are the same thing here.
  const open = (query.data ?? []).filter((s) => s.status === "active");

  return (
    <WorkspacePage
      title="Incident Queue"
      description="Your open investigations — everything still awaiting a verdict."
      state={
        query.isPending
          ? "loading"
          : query.isError
            ? "error"
            : open.length === 0
              ? "empty"
              : "ready"
      }
      emptyState={{
        title: "Nothing in the queue",
        description:
          "Every investigation you've started has been submitted. Launch a new scenario to add one.",
      }}
      table={{
        title: "Open incidents",
        columns: ["Investigation", "Category", "Started", ""],
        rows: open.map((s) => [
          <span className="font-medium">{s.scenarioTitle}</span>,
          <span className="capitalize text-secondary">{s.scenarioCategory}</span>,
          <span className="text-muted-foreground">{formatRelativeTime(s.startedAt)}</span>,
          <Link
            to="/app/cases/$id"
            params={{ id: s.id }}
            className="inline-flex items-center gap-1 text-[color:var(--info)] hover:opacity-80"
          >
            Open case
          </Link>,
        ]),
      }}
    />
  );
}
