import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/soc/workspace-page";
import { useAuditLogs } from "@/hooks/use-audit-logs";

export const Route = createFileRoute("/app/audit-logs")({
  component: AuditLogs,
  head: () => ({
    meta: [
      { title: "ThreatLens · Audit Logs" },
      {
        name: "description",
        content: "Platform-wide audit trail — investigation actions, grading, and admin events.",
      },
      { property: "og:title", content: "ThreatLens · Audit Logs" },
      { property: "og:description", content: "Append-only audit trail across the platform." },
    ],
  }),
});

function AuditLogs() {
  const { entries: logs, isPending, isError } = useAuditLogs();

  const gradingOverrides = logs.filter((l) => l.action === "submit_feedback").length;
  const cohortActions = logs.filter((l) => l.action === "cohort_created").length;

  return (
    <WorkspacePage
      title="Audit Logs"
      description="Append-only record of investigation actions, grading decisions, and administrative changes."
      state={isPending ? "loading" : isError ? "error" : logs.length === 0 ? "empty" : "ready"}
      errorMessage="This page is restricted to platform administrators."
      emptyState={{
        title: "No events yet",
        description: "Audit events will appear here as they occur.",
      }}
      stats={[
        { label: "Events (most recent 100)", value: String(logs.length) },
        { label: "Grading overrides", value: String(gradingOverrides), tone: "high" },
        { label: "Cohorts created", value: String(cohortActions) },
        {
          label: "Earliest shown",
          value: logs.length
            ? new Date(logs[logs.length - 1].occurredAt).toLocaleDateString()
            : "—",
        },
      ]}
      table={{
        title: "Recent events",
        columns: ["Time", "Actor", "Action", "Target", "IP"],
        rows: logs.map((l) => [
          <span className="font-mono text-[11px] text-muted-foreground">
            {new Date(l.occurredAt).toLocaleString()}
          </span>,
          <span className="font-medium">{l.actorDisplayName ?? "System"}</span>,
          <span className="font-mono text-[11px] text-[color:var(--info)]">{l.action}</span>,
          <span className="font-mono text-[11px]">
            {l.targetType}:{l.targetId.slice(0, 8)}
          </span>,
          <span className="font-mono text-[11px] text-muted-foreground">{l.actorIp ?? "—"}</span>,
        ]),
      }}
    />
  );
}
