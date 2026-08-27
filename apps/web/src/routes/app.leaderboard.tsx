import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/soc/workspace-page";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/app/leaderboard")({
  component: Leaderboard,
  head: () => ({
    meta: [
      { title: "ThreatLens · Leaderboard" },
      {
        name: "description",
        content: "Cohort ranking by investigation score, accuracy, and evidence quality.",
      },
      { property: "og:title", content: "ThreatLens · Leaderboard" },
      {
        property: "og:description",
        content: "How your investigation performance compares across the cohort.",
      },
    ],
  }),
});

function Leaderboard() {
  const { leaderboard, state } = useLeaderboard();
  return (
    <WorkspacePage
      title="Leaderboard"
      description="Ranking is weighted by investigation accuracy and evidence completeness, not speed alone."
      state={state}
      emptyState={{
        title: "No ranked analysts yet",
        description: "Scores appear once cases are graded.",
      }}
      stats={[
        { label: "Your rank", value: "#4", delta: "of 128 analysts", tone: "info" },
        { label: "Your score", value: "8,904", delta: "+412 this week" },
        { label: "Accuracy", value: "89%", delta: "cohort avg. 78%", tone: "success" },
        { label: "Percentile", value: "Top 10%", tone: "success" },
      ]}
      table={{
        title: "Cohort ranking — Autumn 2026",
        columns: ["#", "Analyst", "Score", "Investigations", "Accuracy", "Evidence"],
        rows: leaderboard.map((l, i) => [
          i === 0 ? (
            <Trophy className="size-3.5 text-[color:var(--warning)]" />
          ) : (
            <span className="tabular-nums text-muted-foreground">{i + 1}</span>
          ),
          <span className="font-medium">{l.name}</span>,
          <span className="tabular-nums">{l.score.toLocaleString()}</span>,
          <span className="tabular-nums">{l.solved}</span>,
          <span className="tabular-nums text-[color:var(--success)]">{88 - i * 2}%</span>,
          <span className="tabular-nums">{94 - i * 3}%</span>,
        ]),
      }}
      asides={[
        {
          title: "Scoring weights",
          items: [
            { label: "Correct conclusion", value: "35%", meter: 35 },
            { label: "Evidence collected", value: "40%", meter: 40 },
            { label: "ATT&CK mapping", value: "15%", meter: 15 },
            { label: "Time to resolution", value: "10%", meter: 10 },
          ],
        },
      ]}
    />
  );
}
