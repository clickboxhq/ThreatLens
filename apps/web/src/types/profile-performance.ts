// Wire contract for GET /profile/performance — the learner's own Performance Overview,
// aggregated server-side (apps/api/src/modules/profile). Unlike types/profile.ts and
// types/dashboard-performance.ts, this IS a real endpoint shape, not a client-side view model.
//
// Every field is a safe post-submission result: score aggregates and public scenario names.
// No ground truth, no answer keys, no other scenarios' solutions.

export type PerformanceTrendDirection = "improving" | "declining" | "steady" | null;

export type RecentPerformanceEntry = {
  sessionId: string;
  scenarioTitle: string;
  scenarioCategory: string;
  overallPercent: number;
  verdictCorrect: boolean;
  scoredAt: string;
};

export type ProfilePerformance = {
  /** Difficulty-weighted mean of completed investigation scores (0–100), or null for a new user. */
  overallPerformance: number | null;
  investigationsCompleted: number;
  scenariosCompleted: number;
  averageScore: number | null;
  bestScore: number | null;
  recentPerformance: RecentPerformanceEntry[];
  trend: {
    direction: PerformanceTrendDirection;
    /** Overall percentages for the last few scored sessions, oldest first. */
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
  generatedAt: string;
};
