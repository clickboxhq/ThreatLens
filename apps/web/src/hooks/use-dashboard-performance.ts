import { useQuery } from "@tanstack/react-query";
import { sessionsService } from "@/services/sessions";
import { cohortsService } from "@/services/cohorts";
import { leaderboardService } from "@/services/leaderboard";
import { listRealScenarios } from "@/services/scenario-catalog/scenario-catalog-service";
import { queryKeys } from "./query-keys";
import { deriveViewState } from "./use-query-state";
import type { SessionListItemDto } from "@/types/threatlens-operations";
import type {
  TrainingKpi,
  InvestigationPerformancePoint,
  RecentInvestigation,
  AssignedScenario,
} from "@/types/dashboard-performance";

const STATUS_LABELS: Record<SessionListItemDto["status"], string> = {
  active: "Active",
  submitted: "Awaiting score",
  scored: "Scored",
  abandoned: "Abandoned",
};

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** Every real, already-fetched domain this dashboard composes to avoid inventing a
 * unified "dashboard performance" endpoint the backend doesn't have — same pattern as
 * use-learning-recommendation.ts. */
export function useDashboardPerformance() {
  const sessionsQuery = useQuery({
    queryKey: [...queryKeys.dashboardPerformance, "sessions"],
    queryFn: () => sessionsService.listMine(),
  });
  const skillRadarQuery = useQuery({
    queryKey: [...queryKeys.dashboardPerformance, "skill-radar"],
    queryFn: () => sessionsService.getSkillRadar(),
  });
  const assignmentsQuery = useQuery({
    queryKey: [...queryKeys.dashboardPerformance, "assignments"],
    queryFn: () => cohortsService.listMyAssignments(),
  });
  const scenariosQuery = useQuery({
    queryKey: [...queryKeys.dashboardPerformance, "scenarios"],
    queryFn: () => listRealScenarios(),
  });
  // Cohort board when they are in one, anonymised platform-wide standing otherwise. The
  // global board carries no other names — the API withholds them, because it spans every
  // organisation on the platform.
  const cohortsQuery = useQuery({
    queryKey: ["cohorts", "mine"],
    queryFn: () => cohortsService.listMine(),
  });
  const cohort = cohortsQuery.data?.[0];
  const leaderboardQuery = useQuery({
    queryKey: [...queryKeys.leaderboard, cohort?.id ?? "global"],
    queryFn: () =>
      cohort
        ? leaderboardService.get("all_time", "cohort", cohort.id)
        : leaderboardService.get("all_time", "global"),
    enabled: !cohortsQuery.isPending,
  });

  const sessions = sessionsQuery.data ?? [];
  const scenarios = scenariosQuery.data ?? [];

  const scoredSessions = sessions.filter((s) => s.status === "scored");
  const scoredWithPercent = scoredSessions.filter(
    (s): s is SessionListItemDto & { overallPercent: number } => s.overallPercent !== null,
  );
  const verdictedSessions = scoredSessions.filter((s) => s.verdictCorrect !== null);
  const submittedSessions = sessions.filter((s) => s.submittedAt !== null);

  const kpis: TrainingKpi[] = [
    {
      label: "Active investigations",
      value: String(sessions.filter((s) => s.status === "active").length),
      tone: "default",
    },
    {
      label: "Awaiting score",
      value: String(sessions.filter((s) => s.status === "submitted").length),
      tone: "info",
    },
    {
      label: "Completed",
      value: String(scoredSessions.length),
      tone: "success",
    },
    {
      label: "Average score",
      value: scoredWithPercent.length
        ? `${average(scoredWithPercent.map((s) => s.overallPercent))}%`
        : "—",
      tone: "success",
    },
    {
      label: "Verdict accuracy",
      value: verdictedSessions.length
        ? `${Math.round(
            (verdictedSessions.filter((s) => s.verdictCorrect).length / verdictedSessions.length) *
              100,
          )}%`
        : "—",
      tone: "info",
    },
    {
      label: "Total attempts",
      value: String(sessions.length),
      tone: "default",
    },
  ];

  const performance = buildMonthlyPerformance(sessions);

  const recentInvestigations: RecentInvestigation[] = sessions.slice(0, 6).map((s) => ({
    id: s.id,
    scenarioTitle: s.scenarioTitle,
    scenarioCategory: s.scenarioCategory,
    status: s.status,
    statusLabel: STATUS_LABELS[s.status],
    overallPercent: s.overallPercent,
    verdictCorrect: s.verdictCorrect,
    ts: formatRelativeTime(s.submittedAt ?? s.startedAt),
  }));

  const assignedScenarios: AssignedScenario[] = (assignmentsQuery.data ?? []).map((a) => {
    const scenario = scenarios.find((sc) => sc.id === a.scenarioId);
    const attemptsForScenario = sessions
      .filter((s) => s.scenarioId === a.scenarioId)
      .sort((x, y) => new Date(y.startedAt).getTime() - new Date(x.startedAt).getTime());
    const latest = attemptsForScenario[0];
    const progress = !latest ? 0 : latest.status === "active" ? 50 : 100;
    const scoredAttempt = attemptsForScenario.find((s) => s.overallPercent !== null);

    return {
      id: a.id,
      title: a.scenarioTitle,
      difficulty: scenario?.difficulty ?? "—",
      progress,
      score: scoredAttempt?.overallPercent ?? null,
      duration: scenario ? `${scenario.estimatedMinutes} min` : "—",
    };
  });

  const mitreMastery = (skillRadarQuery.data ?? []).map((entry) => ({
    tactic: entry.tacticName,
    mastery: entry.percent,
    practiced: entry.hitCount,
    total: entry.requiredCount,
  }));

  return {
    kpis,
    performance,
    recentInvestigations,
    assignedScenarios,
    mitreMastery,
    // Real leaderboard entries, reshaped to the field names this dashboard panel already
    // renders (see use-leaderboard.ts for the direct, unmapped version). displayName is null
    // for other people on the anonymised global board, so the row falls back to its rank.
    leaderboard: (leaderboardQuery.data?.entries ?? []).map((e) => ({
      name: e.displayName ?? `Rank ${e.rank}`,
      isYou: e.userId !== null && e.userId === leaderboardQuery.data?.myEntry?.userId,
      score: e.points,
      solved: e.completions,
    })),
    leaderboardScope: {
      cohortName: cohort?.name ?? null,
      anonymised: leaderboardQuery.data?.anonymised ?? true,
    },
    summary: {
      started: sessions.length,
      completed: scoredSessions.length,
      averageScore: scoredWithPercent.length
        ? average(scoredWithPercent.map((s) => s.overallPercent))
        : null,
      averageMinutesToResolution: averageMinutesToResolution(submittedSessions),
      overallMastery: mitreMastery.length ? average(mitreMastery.map((m) => m.mastery)) : null,
    },
    state: deriveViewState(sessionsQuery),
  };
}

function averageMinutesToResolution(sessions: SessionListItemDto[]): number | null {
  const durations = sessions
    .filter((s): s is SessionListItemDto & { submittedAt: string } => s.submittedAt !== null)
    .map((s) => (new Date(s.submittedAt).getTime() - new Date(s.startedAt).getTime()) / 60_000);
  return durations.length ? average(durations) : null;
}

/** Buckets real sessions by the calendar month they were started in — only months with at
 * least one attempt appear, oldest first, mirroring how the chart used to show a fixed
 * multi-month trend without inventing months that never happened. */
function buildMonthlyPerformance(sessions: SessionListItemDto[]): InvestigationPerformancePoint[] {
  const buckets = new Map<string, { key: string; sessions: SessionListItemDto[] }>();

  for (const session of sessions) {
    const date = new Date(session.startedAt);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const label = date.toLocaleDateString(undefined, { month: "short" });
    const bucket = buckets.get(key) ?? { key: label, sessions: [] };
    bucket.sessions.push(session);
    buckets.set(key, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, bucket]) => {
      const scored = bucket.sessions.filter((s) => s.overallPercent !== null);
      const withDuration = bucket.sessions.filter((s) => s.submittedAt !== null);
      return {
        m: bucket.key,
        started: bucket.sessions.length,
        completed: bucket.sessions.filter((s) => s.status === "scored").length,
        score: scored.length ? average(scored.map((s) => s.overallPercent as number)) : 0,
        mttr: withDuration.length ? (averageMinutesToResolution(withDuration) ?? 0) : 0,
      };
    });
}
