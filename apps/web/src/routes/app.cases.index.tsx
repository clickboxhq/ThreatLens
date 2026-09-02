import { createFileRoute, Link } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/soc/workspace-page";
import { StatusBadge } from "@/components/soc/primitives";
import { useMySessions } from "@/hooks/use-sessions";
import { deriveViewState } from "@/hooks/use-query-state";
import { formatRelativeTime } from "@/lib/format-relative-time";
import type { SessionStatus } from "@/types/threatlens-investigation";
import type { SessionListItemDto } from "@/types/threatlens-operations";

export const Route = createFileRoute("/app/cases/")({
  component: CaseManagement,
  head: () => ({
    meta: [
      { title: "ThreatLens · Case Management" },
      {
        name: "description",
        content: "Manage investigation cases, findings, and conclusions in ThreatLens.",
      },
      { property: "og:title", content: "ThreatLens · Case Management" },
      {
        property: "og:description",
        content: "Case files, findings, and graded conclusions for SOC training investigations.",
      },
    ],
  }),
});

// Sessions don't carry a "severity"-shaped status the way an alert or an incident does, so this
// maps onto the closest real lifecycle stage instead: still being worked, awaiting the async
// scoring job, or graded.
const STATUS_LABEL: Record<SessionStatus, "open" | "in-progress" | "resolved"> = {
  active: "open",
  submitted: "in-progress",
  scored: "resolved",
  abandoned: "in-progress",
};

function scoreLabel(session: SessionListItemDto) {
  return session.overallPercent == null ? "—" : `${Math.round(session.overallPercent)}%`;
}

function CaseManagement() {
  const query = useMySessions();
  const sessions = query.data ?? [];
  const open = sessions.filter((s) => s.status === "active").length;
  const awaitingScore = sessions.filter((s) => s.status === "submitted").length;
  const scored = sessions.filter((s) => s.status === "scored");
  const avgScore = scored.length
    ? Math.round(scored.reduce((sum, s) => sum + (s.overallPercent ?? 0), 0) / scored.length)
    : null;

  return (
    <WorkspacePage
      title="Case Management"
      description="Every investigation you've launched, and its verdict once it's graded."
      state={deriveViewState(query)}
      emptyState={{
        title: "No investigations yet",
        description: "Launch a scenario from the Scenario Library to open your first case.",
      }}
      stats={[
        { label: "Open investigations", value: String(open), tone: open > 0 ? "high" : "success" },
        { label: "Awaiting score", value: String(awaitingScore), tone: "info" },
        { label: "Graded", value: String(scored.length), tone: "success" },
        { label: "Average score", value: avgScore == null ? "—" : `${avgScore}%`, tone: "success" },
      ]}
      table={{
        title: "Case files",
        columns: ["Case", "Scenario", "Category", "Status", "Score", "Started", "Last activity"],
        rows: sessions.map((s) => [
          <Link
            to="/app/cases/$id"
            params={{ id: s.id }}
            className="font-mono text-[11px] text-[color:var(--info)]"
          >
            {s.id.slice(0, 8)}
          </Link>,
          <span className="font-medium">{s.scenarioTitle}</span>,
          <span className="capitalize text-secondary">{s.scenarioCategory}</span>,
          <StatusBadge status={STATUS_LABEL[s.status]} />,
          <span className="tabular-nums">{scoreLabel(s)}</span>,
          <span className="text-muted-foreground">{formatRelativeTime(s.startedAt)}</span>,
          <span className="text-muted-foreground">
            {formatRelativeTime(s.submittedAt ?? s.startedAt)}
          </span>,
        ]),
      }}
    />
  );
}
