import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/soc/workspace-page";
import { StatusBadge } from "@/components/soc/primitives";
import { useAssessments } from "@/hooks/use-assessments";

export const Route = createFileRoute("/app/assessments")({
  component: Assessments,
  head: () => ({
    meta: [
      { title: "ThreatLens · Assessments" },
      {
        name: "description",
        content:
          "Timed investigation assessments with automated grading and ground-truth comparison.",
      },
      { property: "og:title", content: "ThreatLens · Assessments" },
      {
        property: "og:description",
        content: "Proctored investigation assessments and grading outcomes.",
      },
    ],
  }),
});

function Assessments() {
  const { rows, stats, gradingBreakdown, state } = useAssessments();
  return (
    <WorkspacePage
      title="Assessments"
      description="Timed, proctored investigations graded against hidden ground truth."
      state={state}
      stats={[
        { label: "Scheduled", value: stats ? String(stats.scheduled) : "—" },
        {
          label: "Submissions",
          value: stats ? String(stats.submissions) : "—",
          delta: stats ? `of ${stats.submissionsExpected} expected` : undefined,
        },
        { label: "Average grade", value: stats ? `${stats.averageGrade}%` : "—", tone: "success" },
        {
          label: "Awaiting review",
          value: stats ? String(stats.awaitingReview) : "—",
          tone: "high",
        },
      ]}
      table={{
        title: "Assessment schedule",
        columns: ["ID", "Assessment", "Cohort", "Window", "Submitted", "Avg. grade", "Status"],
        rows: rows.map((r) => [
          <span className="font-mono text-[11px] text-muted-foreground">{r.id}</span>,
          <span className="font-medium">{r.name}</span>,
          <span className="font-mono text-[11px] text-secondary">{r.cohort}</span>,
          r.window,
          <span className="tabular-nums">
            {r.submitted}/{r.total}
          </span>,
          <span className="tabular-nums">{r.avg ? `${r.avg}%` : "—"}</span>,
          <StatusBadge status={r.status} />,
        ]),
      }}
      asides={[{ title: "Grading breakdown", items: gradingBreakdown }]}
    />
  );
}
