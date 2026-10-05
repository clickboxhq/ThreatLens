import { Link } from "@tanstack/react-router";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, XCircle } from "lucide-react";
import { Panel } from "@/components/soc/primitives";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { cn } from "@/lib/utils";
import type { ProfilePerformance, PerformanceTrendDirection } from "@/types/profile-performance";

function humanizeCategory(category: string): string {
  return category
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function TrendBadge({ direction }: { direction: PerformanceTrendDirection }) {
  if (!direction) return null;
  const config = {
    improving: {
      label: "Improving",
      icon: ArrowUpRight,
      className: "text-[color:var(--success)]",
    },
    declining: {
      label: "Declining",
      icon: ArrowDownRight,
      className: "text-[color:var(--critical)]",
    },
    steady: { label: "Steady", icon: ArrowRight, className: "text-secondary" },
  }[direction];
  const Icon = config.icon;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-[12px] font-medium", config.className)}
    >
      <Icon className="size-3.5" />
      {config.label}
    </span>
  );
}

function HeroMetric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--card-border-tint)] bg-background/40 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-[22px] font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-secondary">{label}</span>
        <span className="tabular-nums text-secondary">{pct(value)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
        <div
          className="h-full rounded-full bg-[color:var(--info)]"
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
    </div>
  );
}

/**
 * The learner's Performance Overview — how they are doing and improving as an analyst, from
 * their own real scored investigations (GET /profile/performance). Renders a genuine empty
 * state for someone who has not completed one yet, rather than a wall of dashes.
 */
export function PerformanceOverview({
  performance,
  state,
}: {
  performance: ProfilePerformance | undefined;
  state: "loading" | "error" | "empty" | "ready";
}) {
  if (state === "loading") {
    return (
      <Panel title="Performance Overview">
        <div className="h-40 animate-pulse rounded-md bg-background/60" />
      </Panel>
    );
  }

  if (state === "error") {
    return (
      <Panel title="Performance Overview">
        <p className="py-6 text-center text-[12.5px] text-muted-foreground">
          Couldn't load your performance data. Try again shortly.
        </p>
      </Panel>
    );
  }

  if (state === "empty" || !performance) {
    return (
      <Panel title="Performance Overview">
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <h3 className="text-[14px] font-medium">No completed investigations yet</h3>
          <p className="max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
            Work a scenario through to a verdict and submit it. Once it's scored, your performance,
            accuracy, and progress over time will build up here.
          </p>
          <Link to="/app/scenarios" className="btn-app-primary mt-1">
            Browse scenarios
          </Link>
        </div>
      </Panel>
    );
  }

  const { metrics, trend } = performance;
  const showTrend = trend.points.length >= 3;
  const trendData = trend.points.map((value, i) => ({ i, value }));

  return (
    <Panel
      title="Performance Overview"
      actions={showTrend ? <TrendBadge direction={trend.direction} /> : undefined}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <HeroMetric
          label="Overall Performance"
          value={pct(performance.overallPerformance)}
          hint="Weighted by difficulty"
        />
        <HeroMetric
          label="Investigations"
          value={String(performance.investigationsCompleted)}
          hint={`${performance.scenariosCompleted} scenario${
            performance.scenariosCompleted === 1 ? "" : "s"
          }`}
        />
        <HeroMetric label="Average Score" value={pct(performance.averageScore)} />
        <HeroMetric label="Best Score" value={pct(performance.bestScore)} />
      </div>

      {showTrend && (
        <div className="mt-4">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Last {trend.points.length} investigations
          </div>
          <div className="h-16 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="perf-trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--info)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--info)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis domain={[0, 100]} hide />
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    background: "var(--popover, #1a1a1a)",
                    border: "1px solid var(--border, #333)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${Math.round(v)}%`, "Score"]}
                  labelFormatter={() => ""}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--info)"
                  strokeWidth={2}
                  fill="url(#perf-trend)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recent performance
          </div>
          <ul className="space-y-1.5">
            {performance.recentPerformance.map((entry) => (
              <li
                key={entry.sessionId}
                className="flex items-center justify-between gap-2 text-[12.5px]"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {entry.verdictCorrect ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-[color:var(--success)]" />
                  ) : (
                    <XCircle className="size-3.5 shrink-0 text-[color:var(--critical)]" />
                  )}
                  <span className="truncate">{entry.scenarioTitle}</span>
                </span>
                <span className="shrink-0 tabular-nums text-secondary">
                  {Math.round(entry.overallPercent)}%
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Analyst accuracy
          </div>
          <div className="space-y-2.5">
            <MetricRow label="Evidence accuracy" value={metrics.evidenceAccuracy} />
            <MetricRow label="Evidence recall" value={metrics.evidenceRecall} />
            <MetricRow label="Technique accuracy" value={metrics.techniqueAccuracy} />
            <MetricRow label="Verdict accuracy" value={metrics.verdictAccuracy} />
            <MetricRow label="Completion rate" value={metrics.completionRate} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 text-[11.5px] text-muted-foreground">
        <span>
          MITRE coverage:{" "}
          <span className="text-secondary">
            {metrics.mitreTacticsCovered}/14 tactics (
            {Math.round(metrics.mitreTacticCoveragePercent)}%)
          </span>
        </span>
        {metrics.averageTimeToResolutionMinutes !== null && (
          <span>
            Avg time to resolution:{" "}
            <span className="text-secondary">
              {Math.round(metrics.averageTimeToResolutionMinutes)} min
            </span>
          </span>
        )}
        <span>Updated {formatRelativeTime(performance.generatedAt)}</span>
      </div>

      {performance.categoryBreakdown.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            By category
          </div>
          <div className="flex flex-wrap gap-2">
            {performance.categoryBreakdown.map((c) => (
              <span
                key={c.category}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2 py-1 text-[11.5px]"
              >
                <span className="text-secondary">{humanizeCategory(c.category)}</span>
                <span className="tabular-nums font-medium">{Math.round(c.averagePercent)}%</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{c.completed} done</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
