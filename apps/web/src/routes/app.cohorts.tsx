import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/soc/workspace-page";
import { useCohorts } from "@/hooks/use-cohorts";

export const Route = createFileRoute("/app/cohorts")({
  component: Cohorts,
  head: () => ({
    meta: [
      { title: "ThreatLens · Cohorts" },
      {
        name: "description",
        content: "Manage analyst cohorts, assigned scenario tracks, and progress.",
      },
      { property: "og:title", content: "ThreatLens · Cohorts" },
      {
        property: "og:description",
        content: "Cohort rosters, tracks, and completion for SOC training programs.",
      },
    ],
  }),
});

function Cohorts() {
  const { cohorts, stats, trackCompletion, state } = useCohorts();
  return (
    <WorkspacePage
      title="Cohorts"
      description="Groups of analysts working a shared scenario track, with per-cohort scoring baselines."
      state={state}
      stats={[
        { label: "Active cohorts", value: stats ? String(stats.activeCohorts) : "—" },
        {
          label: "Enrolled analysts",
          value: stats ? String(stats.enrolledAnalysts) : "—",
          delta: "+12 this month",
        },
        { label: "Average score", value: stats ? `${stats.averageScore}%` : "—", tone: "success" },
        {
          label: "At-risk learners",
          value: stats ? String(stats.atRiskLearners) : "—",
          tone: "high",
        },
      ]}
      table={{
        title: "Cohort roster",
        columns: ["ID", "Cohort", "Track", "Analysts", "Progress", "Avg. score", "Instructor"],
        rows: cohorts.map((c) => [
          <span className="font-mono text-[11px] text-muted-foreground">{c.id}</span>,
          <span className="font-medium">{c.name}</span>,
          c.track,
          <span className="tabular-nums">{c.learners}</span>,
          <div className="flex items-center gap-2">
            <div className="h-1 w-20 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-[color:var(--info)]"
                style={{ width: `${c.progress}%` }}
              />
            </div>
            <span className="tabular-nums text-muted-foreground">{c.progress}%</span>
          </div>,
          <span className="tabular-nums">{c.avg}%</span>,
          c.instructor,
        ]),
      }}
      asides={[{ title: "Track completion", items: trackCompletion }]}
    />
  );
}
