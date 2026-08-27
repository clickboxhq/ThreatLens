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
        content:
          "Platform audit trail for investigation actions, grading changes, and admin events.",
      },
      { property: "og:title", content: "ThreatLens · Audit Logs" },
      {
        property: "og:description",
        content: "Immutable audit trail across the ThreatLens platform.",
      },
    ],
  }),
});

function AuditLogs() {
  const { entries: logs, stats, categories, state } = useAuditLogs();
  return (
    <WorkspacePage
      title="Audit Logs"
      description="Immutable record of investigation actions, grading decisions, and administrative changes."
      state={state}
      stats={[
        { label: "Events (24h)", value: stats ? stats.eventsLast24h.toLocaleString() : "—" },
        { label: "Admin actions", value: stats ? String(stats.adminActions) : "—" },
        {
          label: "Grading overrides",
          value: stats ? String(stats.gradingOverrides) : "—",
          tone: "high",
        },
        { label: "Retention", value: stats ? `${stats.retentionDays} days` : "—" },
      ]}
      table={{
        title: "Recent events",
        columns: ["Time", "Actor", "Action", "Target", "Context", "Source IP", "Result"],
        rows: logs.map((l) => [
          <span className="font-mono text-[11px] text-muted-foreground">{l.ts}</span>,
          <span className="font-medium" title={l.userAgent}>
            {l.actor}
          </span>,
          <span className="font-mono text-[11px] text-[color:var(--info)]">{l.action}</span>,
          <span className="font-mono text-[11px]">{l.target}</span>,
          <span className="text-secondary">{l.ctx}</span>,
          <span className="font-mono text-[11px] text-muted-foreground">{l.ip}</span>,
          <span
            className="text-[11px] font-medium"
            style={{ color: l.result === "success" ? "var(--success)" : "var(--critical)" }}
          >
            {l.result === "success" ? "Success" : "Failure"}
          </span>,
        ]),
      }}
      asides={[{ title: "Event categories", items: categories }]}
    />
  );
}
