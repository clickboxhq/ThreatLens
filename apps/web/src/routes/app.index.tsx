import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, SectionHeader, StatCard } from "@/components/soc/primitives";
import { IconTile } from "@/components/soc/ui/icon-tile";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertOctagon,
  Award,
  ArrowUpRight,
  Gauge,
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
import { useLearningOverview } from "@/hooks/use-learning-center";
import { useCertificates } from "@/hooks/use-certificates";
import { useActiveSession } from "@/hooks/use-active-session";
import { useAuthUser } from "@/lib/auth-store";
import { formatRelativeTime } from "@/lib/format-relative-time";

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
  <ShieldAlert className="size-4" key="e" />,
  <Activity className="size-4" key="f" />,
];

function masteryTone(v: number) {
  if (v >= 85) return "var(--success)";
  if (v >= 70) return "var(--info)";
  if (v >= 60) return "var(--warning)";
  return "var(--high)";
}

function Dashboard() {
  const user = useAuthUser();
  const {
    kpis: trainingKpis,
    performance: investigationPerformance,
    recentInvestigations,
    assignedScenarios,
    mitreMastery,
    leaderboard,
    leaderboardScope,
    summary,
  } = useDashboardPerformance();
  const { recommendation } = useLearningRecommendation();
  const { tracks } = useLearningOverview();
  const { certificates } = useCertificates();
  const { activeSessions } = useActiveSession();
  // Most recently started active investigation — the one thing worth resuming right now,
  // rather than the generic "Resume investigation" link this replaces.
  const priority = activeSessions[0];

  const recentCertificates = [...certificates]
    .filter((c) => !c.revoked)
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
    .slice(0, 3);

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <SectionHeader
        title={user ? `Welcome back, ${user.displayName}` : "Welcome back"}
        description="Your investigation activity, scoring, and ATT&CK mastery across every scenario you've attempted."
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

      {/* Priority investigation */}
      <div className="mb-6">
        <div className="glass-card flex items-center gap-3 px-4 py-3.5">
          {priority ? (
            <>
              <IconTile tone="warning" size="md">
                <ShieldAlert className="size-4" />
              </IconTile>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Priority investigation
                </div>
                <div className="truncate text-[13.5px] font-semibold">{priority.scenarioTitle}</div>
                <div className="mt-0.5 text-[11px] text-secondary">
                  Started {formatRelativeTime(priority.startedAt)} · still in progress
                </div>
              </div>
              <Link
                to="/app/cases/$id"
                params={{ id: priority.id }}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary-hover"
              >
                Resume <ArrowUpRight className="size-3.5" />
              </Link>
            </>
          ) : (
            <>
              <IconTile size="md">
                <PlayCircle className="size-4" />
              </IconTile>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Priority investigation
                </div>
                <div className="text-[13px] text-secondary">
                  Nothing in progress — launch a scenario to start one.
                </div>
              </div>
              <Link
                to="/app/scenarios"
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[12px] text-secondary hover:text-foreground"
              >
                Browse
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Training KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {trainingKpis.map((k, i) => (
          <StatCard
            key={k.label}
            label={k.label}
            value={k.value}
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
            </div>
          }
        >
          {investigationPerformance.length > 0 ? (
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
          ) : (
            <div className="flex h-[260px] items-center justify-center text-[12px] text-muted-foreground">
              No investigations yet — launch a scenario to start building your performance history.
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-[11px] md:grid-cols-4">
            <div>
              <div className="text-muted-foreground">Investigations started</div>
              <div className="mt-0.5 text-[15px] font-semibold tabular-nums">{summary.started}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Completed</div>
              <div className="mt-0.5 text-[15px] font-semibold tabular-nums">
                {summary.completed}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Average score</div>
              <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-[color:var(--success)]">
                {summary.averageScore !== null ? `${summary.averageScore}%` : "—"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Time to resolution</div>
              <div className="mt-0.5 text-[15px] font-semibold tabular-nums">
                {summary.averageMinutesToResolution !== null
                  ? `${summary.averageMinutesToResolution} min`
                  : "—"}
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="MITRE ATT&CK mastery"
          actions={
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {summary.overallMastery !== null
                ? `${summary.overallMastery}% overall`
                : "No data yet"}
            </span>
          }
        >
          {mitreMastery.length > 0 ? (
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
          ) : (
            <div className="flex h-full min-h-[120px] items-center justify-center text-center text-[12px] text-muted-foreground">
              Complete and score an investigation to see your ATT&CK tactic mastery.
            </div>
          )}
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
          {recentInvestigations.length > 0 ? (
            <div className="divide-y divide-border">
              {recentInvestigations.map((r) => (
                <Link
                  key={r.id}
                  to="/app/cases/$id"
                  params={{ id: r.id }}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-background/40"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[13px] font-medium">{r.scenarioTitle}</span>
                      <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] capitalize text-secondary">
                        {r.scenarioCategory}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-[11px] text-muted-foreground">
                      {r.overallPercent !== null ? (
                        <span className="text-secondary">Score {r.overallPercent}%</span>
                      ) : (
                        "Not yet scored"
                      )}
                      {r.verdictCorrect !== null && (
                        <>
                          {" · "}
                          <span
                            className={
                              r.verdictCorrect
                                ? "text-[color:var(--success)]"
                                : "text-[color:var(--high)]"
                            }
                          >
                            {r.verdictCorrect ? "Verdict correct" : "Verdict incorrect"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-medium text-secondary">{r.statusLabel}</div>
                    <div className="mt-1 text-[10.5px] text-muted-foreground tabular-nums">
                      {r.ts}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
              No investigations yet.
            </div>
          )}
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
          {assignedScenarios.length > 0 ? (
            <div className="divide-y divide-border">
              {assignedScenarios.map((s) => (
                <div key={s.id} className="px-4 py-3 transition-colors hover:bg-background/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-medium">{s.title}</span>
                    <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] capitalize text-secondary">
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
                    <span>{s.duration}</span>
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
          ) : (
            <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
              Nothing assigned yet — join a cohort to see instructor assignments here.
            </div>
          )}
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

      {/* Cohort + skills */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title={
            leaderboardScope.cohortName
              ? `${leaderboardScope.cohortName} leaderboard`
              : "Global standing"
          }
          padded={false}
          actions={
            leaderboardScope.anonymised ? (
              <span className="text-[10.5px] text-muted-foreground">Names hidden</span>
            ) : undefined
          }
        >
          {leaderboard.length > 0 ? (
            <div className="divide-y divide-border">
              {leaderboard.map((l, i) => (
                <div
                  key={`${l.name}-${i}`}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    l.isYou && "bg-[color:var(--info)]/5",
                  )}
                >
                  <IconTile
                    size="sm"
                    className={cn(
                      "text-[11px] font-semibold",
                      i === 0 ? "text-warning" : "text-secondary",
                    )}
                  >
                    {i === 0 ? <Trophy className="size-3.5" /> : i + 1}
                  </IconTile>
                  <div className="flex-1 text-[13px] font-medium">
                    {l.isYou ? `${l.name} (you)` : l.name}
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] tabular-nums">{l.score.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {l.solved} investigations
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-[12px] text-muted-foreground">
              No leaderboard entries yet.
            </div>
          )}
        </Panel>

        <Panel title="Skill tracks & certificates" padded={false}>
          {tracks.length > 0 ? (
            <div className="space-y-3 p-4">
              {tracks.map((t) => (
                <div key={t.id}>
                  <div className="flex items-center justify-between text-[12px]">
                    <span>{t.name}</span>
                    <span className="tabular-nums text-secondary">{t.progress}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background">
                    <div
                      className="h-full rounded-full bg-[color:var(--info)]"
                      style={{ width: `${t.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">
              No learning tracks available yet.
            </div>
          )}
          <div className="border-t border-border p-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recent certificates
            </div>
            {recentCertificates.length > 0 ? (
              recentCertificates.map((c) => (
                <div key={c.publicId} className="flex items-center gap-2 py-1.5 text-[12px]">
                  <Award className="size-3.5 text-[color:var(--info)]" />
                  <span className="flex-1 truncate">{c.careerTrackName}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(c.issuedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-1.5 text-[12px] text-muted-foreground">
                Complete a learning path to earn your first certificate.
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
