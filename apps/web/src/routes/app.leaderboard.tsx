import { createFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/components/soc/workspace-page";
import { useLeaderboard } from "@/hooks/use-leaderboard";
import type { LeaderboardPeriod } from "@/types/socverse-learning";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/app/leaderboard")({
  component: Leaderboard,
  head: () => ({
    meta: [
      { title: "ThreatLens · Leaderboard" },
      {
        name: "description",
        content: "Ranking by investigation points — harder scenarios weighted higher.",
      },
      { property: "og:title", content: "ThreatLens · Leaderboard" },
      {
        property: "og:description",
        content: "How your investigation performance compares platform-wide.",
      },
    ],
  }),
});

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: "weekly", label: "This week" },
  { value: "monthly", label: "This month" },
  { value: "all_time", label: "All time" },
];

function Leaderboard() {
  const { period, setPeriod, leaderboard, isPending, isError } = useLeaderboard();
  const entries = leaderboard?.entries ?? [];
  const myEntry = leaderboard?.myEntry ?? null;

  return (
    <WorkspacePage
      title="Leaderboard"
      description="Points are weighted by scenario difficulty, not just raw score — see the breakdown below."
      state={isPending ? "loading" : isError ? "error" : entries.length === 0 ? "empty" : "ready"}
      emptyState={{
        title: "No ranked analysts yet",
        description: "Points appear once cases are graded.",
      }}
      actions={
        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`h-8 rounded px-3 text-[12px] ${
                period === p.value
                  ? "bg-[color:var(--info)]/15 text-[color:var(--info)]"
                  : "text-secondary hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      }
      stats={[
        {
          label: "Your rank",
          value: myEntry ? `#${myEntry.rank}` : "Unranked",
          delta: entries.length ? `of ${entries.length} analysts` : undefined,
          tone: "info",
        },
        { label: "Your points", value: myEntry ? myEntry.points.toLocaleString() : "—" },
        {
          label: "Your accuracy",
          value: myEntry ? `${myEntry.averagePercent}%` : "—",
          tone: "success",
        },
        { label: "Investigations scored", value: myEntry ? String(myEntry.completions) : "0" },
      ]}
      table={{
        title: "Top analysts",
        columns: ["#", "Analyst", "Points", "Investigations", "Avg. score"],
        rows: entries.map((e) => [
          e.rank === 1 ? (
            <Trophy className="size-3.5 text-[color:var(--warning)]" />
          ) : (
            <span className="tabular-nums text-muted-foreground">{e.rank}</span>
          ),
          <span className="font-medium">{e.displayName}</span>,
          <span className="tabular-nums">{e.points.toLocaleString()}</span>,
          <span className="tabular-nums">{e.completions}</span>,
          <span className="tabular-nums text-[color:var(--success)]">{e.averagePercent}%</span>,
        ]),
      }}
      asides={[
        {
          title: "Difficulty multiplier",
          items: [
            { label: "Beginner", value: "×1" },
            { label: "Intermediate", value: "×1.5" },
            { label: "Advanced", value: "×2" },
            { label: "Expert", value: "×3" },
          ],
        },
      ]}
    />
  );
}
