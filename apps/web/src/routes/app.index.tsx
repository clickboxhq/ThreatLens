import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, SectionHeader, StatCard, SeverityBadge } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertOctagon,
  ArrowUpRight,
  Award,
  Crosshair,
  Gauge,
  ListChecks,
  PlayCircle,
  ShieldAlert,
  Target,
  Trophy,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDashboardPerformance } from "@/hooks/use-dashboard-performance";
import { useLearningRecommendation } from "@/hooks/use-learning-recommendation";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "ThreatLens · Investigation Dashboard" },
      {
        name: "description",
        content:
          "Learner investigation performance, MITRE ATT&CK mastery, and assigned SOC training scenarios.",
      },
    ],
  }),
});

const kpiIcons = [
  <Activity className="size-4" key="a" />,
  <AlertOctagon className="size-4" key="b" />,
  <Gauge className="size-4" key="c" />,
  <Target className="size-4" key="d" />,
  <Crosshair className="size-4" key="e" />,
  <ShieldAlert className="size-4" key="f" />,
];

function masteryTone(v: number) {
  if (v >= 85) return "var(--success)";
  if (v >= 70) return "var(--info)";
  if (v >= 60) return "var(--warning)";
  return "var(--high)";
}

function Dashboard() {
  const {
    kpis: trainingKpis,
    performance: investigationPerformance,
    recentInvestigations,
    assignedScenarios,
    mitreMastery,
    leaderboard,
  } = useDashboardPerformance();
  const { recommendation } = useLearningRecommendation();
  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title="Welcome back, John"
        description="Your investigation activity, scoring, and ATT&CK mastery across the Contoso Global SOC training environment."
        actions={
          <>
            <Link
              to="/app/scenarios"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-[12px] text-secondary hover:text-foreground"
            >
              <PlayCircle className="size-3.5" /> Explore scenarios
            </Link>
            <Link
              to="/app/cases"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
            >
              <ShieldAlert className="size-3.5" /> Resume investigation
            </Link>
          </>
        }
      />

      {/* Training KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {trainingKpis.map((k, i) => (
          <StatCard
            key={k.label}
            label={k.label}
            value={k.value}
            delta={k.delta}
            tone={k.tone}
            icon={kpiIcons[i]}
          />
        ))}
      </div>

      {/* Performance + ATT&CK mastery */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Investigation performance"
          actions={
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-[color:var(--info)]" /> Started
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-[color:var(--success)]" /> Completed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-muted-foreground/70" /> Avg. score
              </span>
              <span className="rounded border border-border bg-background px-2 py-0.5 text-secondary">
                Feb – Aug
              </span>
            </div>
          }
        >
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={investigationPerformance}
                margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gStarted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--info)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--info)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--success)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="m"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="started"
                  name="Started"
                  stroke="var(--info)"
                  strokeWidth={2}
                  fill="url(#gStarted)"
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Completed"
                  stroke="var(--success)"
                  strokeWidth={2}
                  fill="url(#gDone)"
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Avg. score"
                  stroke="var(--muted-foreground)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="mttr"
                  name="Time to resolution (min)"
                  stroke="var(--warning)"
                  strokeWidth={1.5}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-[11px] md:grid-cols-4">
            <div>
              <div className="text-muted-foreground">Investigations started</div>
              <div className="mt-0.5 text-[15px] font-semibold tabular-nums">47</div>
            </div>
            <div>
              <div className="text-muted-foreground">Completed</div>
              <div className="mt-0.5 text-[15px] font-semibold tabular-nums">44</div>
            </div>
            <div>
              <div className="text-muted-foreground">Average score</div>
              <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-[color:var(--success)]">
                92%
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Time to resolution</div>
              <div className="mt-0.5 text-[15px] font-semibold tabular-nums">34 min</div>
            </div>
          </div>
        </Panel>

        <Panel
          title="MITRE ATT&CK mastery"
          actions={
            <span className="text-[11px] text-muted-foreground tabular-nums">76% overall</span>
          }
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {mitreMastery.map((t) => {
              const tone = masteryTone(t.mastery);
              return (
                <div
                  key={t.tactic}
                  className="rounded-md border p-2.5"
                  style={{
                    borderColor: `color-mix(in oklab, ${tone} 35%, var(--card-border-tint))`,
                    background: `color-mix(in oklab, ${tone} 8%, var(--card))`,
                  }}
                >
                  <div className="truncate text-[10.5px] text-secondary">{t.tactic}</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span
                      className="text-[16px] font-semibold tabular-nums"
                      style={{ color: tone }}
                    >
                      {t.mastery}%
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                    {t.practiced}/{t.total} techniques
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Recent investigations + assigned scenarios */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Recent investigations"
          padded={false}
          actions={
            <Link
              to="/app/cases"
              className="inline-flex items-center gap-1 text-[12px] text-secondary hover:text-foreground"
            >
              View queue <ArrowUpRight className="size-3" />
            </Link>
          }
        >
          <div className="divide-y divide-border">
            {recentInvestigations.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-background/40"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10.5px] text-muted-foreground">{r.id}</span>
                    <span className="truncate text-[13px] font-medium">{r.title}</span>
                    <SeverityBadge level={r.severity} />
                  </div>
                  <div className="mt-1 truncate text-[11px] text-muted-foreground">
                    {r.subjectLabel}: <span className="text-secondary">{r.subject}</span> ·{" "}
                    {r.mitre}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 w-32 overflow-hidden rounded-full bg-background">
                      <div
                        className="h-full rounded-full bg-[color:var(--info)]"
                        style={{ width: `${r.progress}%` }}
                      />
                    </div>
                    <span className="text-[10.5px] tabular-nums text-muted-foreground">
                      {r.progress}% complete
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-medium text-secondary">{r.statusLabel}</div>
                  <div className="mt-1 text-[10.5px] text-muted-foreground tabular-nums">
                    {r.ts}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Assigned scenarios"
          padded={false}
          actions={
            <Link to="/app/scenarios" className="text-[12px] text-secondary hover:text-foreground">
              Library
            </Link>
          }
        >
          <div className="divide-y divide-border">
            {assignedScenarios.map((s) => (
              <div key={s.id} className="px-4 py-3 transition-colors hover:bg-background/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium">{s.title}</span>
                  <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-secondary">
                    {s.difficulty}
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${s.progress}%`,
                      background: s.progress === 100 ? "var(--success)" : "var(--info)",
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[10.5px] text-muted-foreground tabular-nums">
                  <span>
                    {s.progress}% · {s.duration}
                  </span>
                  <span>
                    {s.score !== null ? (
                      <span className="text-[color:var(--success)]">Score {s.score}%</span>
                    ) : (
                      "Not graded"
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {recommendation && (
        <Panel className="mt-6" title="Recommended practice">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <IconTile tone="warning" size="md">
                <Target className="size-4" />
              </IconTile>
              <div>
                <div className="text-[13px] font-medium">{recommendation.scenarioTitle}</div>
                <p className="mt-0.5 max-w-lg text-[11.5px] text-secondary">
                  {recommendation.reason}
                </p>
              </div>
            </div>
            <Link
              to="/app/scenarios"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
            >
              Start scenario <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </Panel>
      )}

      {/* Cohort + skills + checklist */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Cohort leaderboard" padded={false}>
          <div className="divide-y divide-border">
            {leaderboard.map((l, i) => (
              <div key={l.name} className="flex items-center gap-3 px-4 py-3">
                <IconTile
                  size="sm"
                  className={cn(
                    "text-[11px] font-semibold",
                    i === 0 ? "text-warning" : "text-secondary",
                  )}
                >
                  {i === 0 ? <Trophy className="size-3.5" /> : i + 1}
                </IconTile>
                <div className="flex-1 text-[13px] font-medium">{l.name}</div>
                <div className="text-right">
                  <div className="text-[12px] tabular-nums">{l.score.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">{l.solved} investigations</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Skill tracks & certificates" padded={false}>
          <div className="space-y-3 p-4">
            {[
              { t: "SOC Analyst Track", v: 74 },
              { t: "Threat Hunter Track", v: 42 },
              { t: "Incident Responder Track", v: 88 },
            ].map((s) => (
              <div key={s.t}>
                <div className="flex items-center justify-between text-[12px]">
                  <span>{s.t}</span>
                  <span className="tabular-nums text-secondary">{s.v}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-[color:var(--info)]"
                    style={{ width: `${s.v}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recent certificates
            </div>
            {[
              { name: "ThreatLens Certified Analyst — L2", when: "Jun 24" },
              { name: "Identity Attack Investigation", when: "Jun 12" },
              { name: "Endpoint Forensics Fundamentals", when: "May 30" },
            ].map((c) => (
              <div key={c.name} className="flex items-center gap-2 py-1.5 text-[12px]">
                <Award className="size-3.5 text-[color:var(--info)]" />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-[11px] text-muted-foreground">{c.when}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Case checklist">
          <div className="flex items-start gap-3">
            <IconTile tone="info" size="lg">
              <ListChecks className="size-4" />
            </IconTile>
            <div className="flex-1">
              <p className="text-[13px] text-secondary">
                On <span className="font-mono text-foreground">INV-3181</span> you have collected
                <span className="text-foreground"> 7 of 9 required artifacts</span>. The message
                trace and the inbox rule created after sign-in are still missing — both are needed
                to justify a BEC conclusion under{" "}
                <span className="font-mono text-foreground">T1114.002</span>.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] text-secondary hover:text-foreground">
                  Show missing evidence
                </button>
                <button className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] text-secondary hover:text-foreground">
                  Explain T1114.002
                </button>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
