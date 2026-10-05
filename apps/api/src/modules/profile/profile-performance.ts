// Pure aggregation for GET /profile/performance — the learner's own post-submission
// investigation record, rolled up server-side (§2.17/§13.2). Kept pure and exported for direct
// unit testing, the same rationale as scoring/scorer.ts and sessions/skill-radar.ts.
//
// Ground-truth boundary (§12.3): every input field here is a Score aggregate or a public
// scenario/session field. Nothing in this file reads a ground_truth_definition, a hidden
// answer key, or another user's data — the service that feeds it filters to one userId and
// selects only these columns.

// §13.5: harder scenarios are worth more, so "overall performance" is not just an unweighted
// mean of every attempt — otherwise farming beginner scenarios would outrank real progress on
// advanced ones. Same multipliers the leaderboard uses.
const DIFFICULTY_WEIGHT: Record<string, number> = {
  beginner: 1,
  intermediate: 1.5,
  advanced: 2,
  expert: 3,
};

// The full MITRE ATT&CK Enterprise tactic count, for coverage as a percentage. Matches the
// TACTIC_NAMES set in sessions/skill-radar.ts.
export const TOTAL_MITRE_TACTICS = 14;

// How many of the most recent scored sessions the "recent performance" list and the trend
// sparkline are built from.
const RECENT_WINDOW = 5;

// A trend needs a real move to be called one — small run-to-run noise stays "steady".
const TREND_DELTA_THRESHOLD = 3;

export interface ScoredSessionFact {
  sessionId: string;
  scenarioId: string;
  scenarioTitle: string;
  scenarioCategory: string;
  difficulty: string;
  overallPercent: number;
  evidencePrecisionPercent: number;
  evidenceRecallPercent: number;
  techniqueAccuracyPercent: number;
  verdictCorrect: boolean;
  falsePositiveCount: number;
  timeToResolutionSeconds: number;
  // ISO string — already serialised by the service so this stays JSON-only and trivially
  // testable.
  scoredAt: string;
}

export interface ProfilePerformanceInput {
  // Every scored session for this user. Order does not matter — this function sorts by
  // scoredAt itself.
  scored: ScoredSessionFact[];
  // Sessions that reached a terminal non-scored state (expired mid-investigation). Used only
  // for the completion-rate denominator.
  abandonedCount: number;
  // Distinct MITRE tactics the user has had at least one required technique for, across all
  // scored sessions (computed by the service via the shared skill-radar helper).
  mitreTacticsCovered: number;
}

export interface RecentPerformanceEntry {
  sessionId: string;
  scenarioTitle: string;
  scenarioCategory: string;
  overallPercent: number;
  verdictCorrect: boolean;
  scoredAt: string;
}

export interface ProfilePerformanceResult {
  overallPerformance: number | null;
  investigationsCompleted: number;
  scenariosCompleted: number;
  averageScore: number | null;
  bestScore: number | null;
  recentPerformance: RecentPerformanceEntry[];
  trend: {
    direction: 'improving' | 'declining' | 'steady' | null;
    points: number[];
  };
  metrics: {
    evidenceAccuracy: number | null;
    evidenceRecall: number | null;
    techniqueAccuracy: number | null;
    verdictAccuracy: number | null;
    completionRate: number | null;
    averageTimeToResolutionMinutes: number | null;
    mitreTacticsCovered: number;
    mitreTacticCoveragePercent: number;
  };
  categoryBreakdown: {
    category: string;
    averagePercent: number;
    completed: number;
  }[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * Rolls a user's scored sessions into the numbers the Performance Overview renders. Every
 * output is safe to show the learner: aggregates of their own results, never a ground-truth
 * field. Returns a fully-formed result for a user with zero scored sessions — nulls and
 * zeros, so the frontend renders an empty state rather than handling a missing payload.
 */
export function computeProfilePerformance(
  input: ProfilePerformanceInput,
): ProfilePerformanceResult {
  const scored = [...input.scored].sort(
    (a, b) => Date.parse(a.scoredAt) - Date.parse(b.scoredAt),
  );

  const investigationsCompleted = scored.length;
  const scenariosCompleted = new Set(scored.map((s) => s.scenarioId)).size;

  const overallPercents = scored.map((s) => s.overallPercent);
  const averageScore = mean(overallPercents);
  const bestScore =
    overallPercents.length > 0 ? Math.max(...overallPercents) : null;

  let overallPerformance: number | null = null;
  if (scored.length > 0) {
    const weightedSum = scored.reduce(
      (sum, s) =>
        sum + s.overallPercent * (DIFFICULTY_WEIGHT[s.difficulty] ?? 1),
      0,
    );
    const weightTotal = scored.reduce(
      (sum, s) => sum + (DIFFICULTY_WEIGHT[s.difficulty] ?? 1),
      0,
    );
    overallPerformance =
      weightTotal > 0 ? round1(weightedSum / weightTotal) : null;
  }

  const recent = scored.slice(-RECENT_WINDOW);
  const recentPerformance: RecentPerformanceEntry[] = [...recent]
    .reverse()
    .map((s) => ({
      sessionId: s.sessionId,
      scenarioTitle: s.scenarioTitle,
      scenarioCategory: s.scenarioCategory,
      overallPercent: s.overallPercent,
      verdictCorrect: s.verdictCorrect,
      scoredAt: s.scoredAt,
    }));

  const trendPoints = recent.map((s) => s.overallPercent);
  const trend = {
    direction: trendDirection(trendPoints),
    points: trendPoints,
  };

  const verdictAccuracy =
    scored.length > 0
      ? round1(
          (scored.filter((s) => s.verdictCorrect).length / scored.length) * 100,
        )
      : null;

  const scoredAndAbandoned = scored.length + input.abandonedCount;
  const completionRate =
    scoredAndAbandoned > 0
      ? round1((scored.length / scoredAndAbandoned) * 100)
      : null;

  const averageTimeToResolutionMinutes =
    scored.length > 0
      ? round1(
          scored.reduce((sum, s) => sum + s.timeToResolutionSeconds, 0) /
            scored.length /
            60,
        )
      : null;

  const byCategory = new Map<string, number[]>();
  for (const s of scored) {
    const list = byCategory.get(s.scenarioCategory) ?? [];
    list.push(s.overallPercent);
    byCategory.set(s.scenarioCategory, list);
  }
  const categoryBreakdown = [...byCategory.entries()]
    .map(([category, percents]) => ({
      category,
      averagePercent: mean(percents) ?? 0,
      completed: percents.length,
    }))
    .sort((a, b) => b.averagePercent - a.averagePercent);

  return {
    overallPerformance,
    investigationsCompleted,
    scenariosCompleted,
    averageScore,
    bestScore,
    recentPerformance,
    trend,
    metrics: {
      evidenceAccuracy: mean(scored.map((s) => s.evidencePrecisionPercent)),
      evidenceRecall: mean(scored.map((s) => s.evidenceRecallPercent)),
      techniqueAccuracy: mean(scored.map((s) => s.techniqueAccuracyPercent)),
      verdictAccuracy,
      completionRate,
      averageTimeToResolutionMinutes,
      mitreTacticsCovered: input.mitreTacticsCovered,
      mitreTacticCoveragePercent: round1(
        (input.mitreTacticsCovered / TOTAL_MITRE_TACTICS) * 100,
      ),
    },
    categoryBreakdown,
  };
}

// Compares the first half of the recent window against the second half. Needs at least two
// points to say anything; a move smaller than the threshold is "steady", not a trend.
function trendDirection(
  points: number[],
): 'improving' | 'declining' | 'steady' | null {
  if (points.length < 2) return null;
  const mid = Math.floor(points.length / 2);
  const earlier = points.slice(0, mid);
  const later = points.slice(points.length - mid);
  const earlierMean = earlier.reduce((s, v) => s + v, 0) / earlier.length;
  const laterMean = later.reduce((s, v) => s + v, 0) / later.length;
  const delta = laterMean - earlierMean;
  if (delta > TREND_DELTA_THRESHOLD) return 'improving';
  if (delta < -TREND_DELTA_THRESHOLD) return 'declining';
  return 'steady';
}
