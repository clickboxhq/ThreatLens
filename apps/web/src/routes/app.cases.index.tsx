import { createFileRoute, Link } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/soc/workspace-page";
import { SeverityBadge, StatusBadge } from "@/components/soc/primitives";
import { useIncidents } from "@/hooks/use-incidents";

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

function CaseManagement() {
  const { incidents } = useIncidents();
  return (
    <WorkspacePage
      title="Case Management"
      description="Case files bundle alerts, evidence, and your written conclusion for grading."
      stats={[
        { label: "Open cases", value: "8", delta: "2 critical", tone: "critical" },
        { label: "Awaiting conclusion", value: "3", tone: "high" },
        { label: "Graded this month", value: "19", tone: "success" },
        { label: "Average grade", value: "92%", tone: "success" },
      ]}
      table={{
        title: "Case files",
        columns: ["Case", "Title", "Severity", "Status", "Alerts", "Entities", "Owner", "Updated"],
        rows: incidents.map((i) => [
          <Link
            to="/app/cases/$id"
            params={{ id: i.id }}
            className="font-mono text-[11px] text-[color:var(--info)]"
          >
            {i.id}
          </Link>,
          <span className="font-medium">{i.title}</span>,
          <SeverityBadge level={i.severity} />,
          <StatusBadge status={i.status} />,
          <span className="tabular-nums">{i.alerts}</span>,
          <span className="tabular-nums">{i.entities}</span>,
          i.owner,
          <span className="text-muted-foreground">{i.updated}</span>,
        ]),
      }}
      asides={[
        {
          title: "Completion by phase",
          items: [
            { label: "Triage", value: "100%", meter: 100 },
            { label: "Scoping", value: "82%", meter: 82 },
            { label: "Evidence", value: "91%", meter: 91 },
            { label: "Conclusion", value: "63%", meter: 63 },
            { label: "Report", value: "48%", meter: 48 },
          ],
        },
      ]}
    />
  );
}
