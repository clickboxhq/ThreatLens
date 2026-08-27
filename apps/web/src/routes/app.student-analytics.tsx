import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/soc/workspace-page";
import { useStudentAnalytics } from "@/hooks/use-student-analytics";

export const Route = createFileRoute("/app/student-analytics")({
  component: StudentAnalytics,
  head: () => ({
    meta: [
      { title: "ThreatLens · Student Analytics" },
      {
        name: "description",
        content: "Per-analyst investigation performance, accuracy, and evidence collection trends.",
      },
      { property: "og:title", content: "ThreatLens · Student Analytics" },
      {
        property: "og:description",
        content: "Instructor view of learner accuracy, evidence rate, and ATT&CK breadth.",
      },
    ],
  }),
});

const riskTone = (r: string) =>
  r === "High" ? "var(--critical)" : r === "Medium" ? "var(--warning)" : "var(--success)";

function StudentAnalytics() {
  const { students, stats, failureModes, state } = useStudentAnalytics();
  return (
    <WorkspacePage
      title="Student Analytics"
      description="Where analysts lose points: missed evidence, wrong verdicts, and unmapped techniques."
      state={state}
      stats={[
        { label: "Analysts tracked", value: stats ? String(stats.analystsTracked) : "—" },
        {
          label: "Cohort accuracy",
          value: stats ? `${stats.cohortAccuracy}%` : "—",
          delta: "+4% this month",
          tone: "success",
        },
        { label: "Evidence rate", value: stats ? `${stats.evidenceRate}%` : "—", tone: "info" },
        {
          label: "At risk",
          value: stats ? String(stats.atRisk) : "—",
          delta: "below 70% accuracy",
          tone: "critical",
        },
      ]}
      table={{
        title: "Analyst performance",
        columns: [
          "Analyst",
          "Cohort",
          "Investigations",
          "Accuracy",
          "Evidence rate",
          "ATT&CK breadth",
          "Risk",
        ],
        rows: students.map((s) => [
          <span className="font-medium">{s.name}</span>,
          <span className="font-mono text-[11px] text-secondary">{s.cohort}</span>,
          <span className="tabular-nums">{s.inv}</span>,
          <span className="tabular-nums">{s.acc}%</span>,
          <span className="tabular-nums">{s.evid}%</span>,
          <span className="tabular-nums">{s.mitre}%</span>,
          <span className="text-[11px] font-medium" style={{ color: riskTone(s.risk) }}>
            {s.risk}
          </span>,
        ]),
      }}
      asides={[{ title: "Common failure modes", items: failureModes }]}
    />
  );
}
