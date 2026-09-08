import {
  computeProfilePerformance,
  type ScoredSessionFact,
} from './profile-performance';

function fact(overrides: Partial<ScoredSessionFact> = {}): ScoredSessionFact {
  return {
    sessionId: overrides.sessionId ?? 'session-1',
    scenarioId: overrides.scenarioId ?? 'scenario-1',
    scenarioTitle: overrides.scenarioTitle ?? 'Business Email Compromise',
    scenarioCategory: overrides.scenarioCategory ?? 'email',
    difficulty: overrides.difficulty ?? 'intermediate',
    overallPercent: overrides.overallPercent ?? 80,
    evidencePrecisionPercent: overrides.evidencePrecisionPercent ?? 75,
    evidenceRecallPercent: overrides.evidenceRecallPercent ?? 70,
    techniqueAccuracyPercent: overrides.techniqueAccuracyPercent ?? 85,
    verdictCorrect: overrides.verdictCorrect ?? true,
    falsePositiveCount: overrides.falsePositiveCount ?? 0,
    timeToResolutionSeconds: overrides.timeToResolutionSeconds ?? 1800,
    scoredAt: overrides.scoredAt ?? '2026-09-01T10:00:00.000Z',
  };
}

describe('computeProfilePerformance', () => {
  it('returns a valid, fully-zeroed result for a user with no scored sessions', () => {
    const result = computeProfilePerformance({
      scored: [],
      abandonedCount: 0,
      mitreTacticsCovered: 0,
    });

    expect(result.investigationsCompleted).toBe(0);
    expect(result.scenariosCompleted).toBe(0);
    expect(result.averageScore).toBeNull();
    expect(result.bestScore).toBeNull();
    expect(result.overallPerformance).toBeNull();
    expect(result.recentPerformance).toEqual([]);
    expect(result.trend.direction).toBeNull();
    expect(result.trend.points).toEqual([]);
    expect(result.metrics.verdictAccuracy).toBeNull();
    expect(result.metrics.completionRate).toBeNull();
    expect(result.metrics.mitreTacticCoveragePercent).toBe(0);
    expect(result.categoryBreakdown).toEqual([]);
  });

  it('counts completed investigations and distinct scenarios', () => {
    const result = computeProfilePerformance({
      scored: [
        fact({ sessionId: 's1', scenarioId: 'a' }),
        fact({ sessionId: 's2', scenarioId: 'a' }),
        fact({ sessionId: 's3', scenarioId: 'b' }),
      ],
      abandonedCount: 0,
      mitreTacticsCovered: 0,
    });

    expect(result.investigationsCompleted).toBe(3);
    expect(result.scenariosCompleted).toBe(2);
  });

  it('averages and takes the max of the real overall percentages', () => {
    const result = computeProfilePerformance({
      scored: [
        fact({ overallPercent: 60, difficulty: 'beginner' }),
        fact({ overallPercent: 90, difficulty: 'beginner' }),
      ],
      abandonedCount: 0,
      mitreTacticsCovered: 0,
    });

    expect(result.averageScore).toBe(75);
    expect(result.bestScore).toBe(90);
    // Equal weights (both beginner) -> weighted mean equals plain mean.
    expect(result.overallPerformance).toBe(75);
  });

  it('weights harder scenarios more heavily in overall performance', () => {
    const result = computeProfilePerformance({
      scored: [
        fact({ overallPercent: 50, difficulty: 'beginner' }), // weight 1
        fact({ overallPercent: 100, difficulty: 'expert' }), // weight 3
      ],
      abandonedCount: 0,
      mitreTacticsCovered: 0,
    });

    expect(result.averageScore).toBe(75);
    // (50*1 + 100*3) / (1 + 3) = 87.5
    expect(result.overallPerformance).toBe(87.5);
  });

  it('reports verdict accuracy as the share of correct verdicts', () => {
    const result = computeProfilePerformance({
      scored: [
        fact({ verdictCorrect: true }),
        fact({ verdictCorrect: true }),
        fact({ verdictCorrect: false }),
        fact({ verdictCorrect: false }),
      ],
      abandonedCount: 0,
      mitreTacticsCovered: 0,
    });

    expect(result.metrics.verdictAccuracy).toBe(50);
  });

  it('computes completion rate against abandoned sessions only', () => {
    const result = computeProfilePerformance({
      scored: [fact(), fact(), fact()],
      abandonedCount: 1,
      mitreTacticsCovered: 0,
    });

    // 3 scored / (3 scored + 1 abandoned) = 75%
    expect(result.metrics.completionRate).toBe(75);
  });

  it('orders recent performance newest-first and the trend oldest-first', () => {
    const result = computeProfilePerformance({
      scored: [
        fact({
          sessionId: 'old',
          overallPercent: 40,
          scoredAt: '2026-08-01T00:00:00.000Z',
        }),
        fact({
          sessionId: 'mid',
          overallPercent: 60,
          scoredAt: '2026-08-15T00:00:00.000Z',
        }),
        fact({
          sessionId: 'new',
          overallPercent: 80,
          scoredAt: '2026-09-01T00:00:00.000Z',
        }),
      ],
      abandonedCount: 0,
      mitreTacticsCovered: 0,
    });

    expect(result.recentPerformance.map((r) => r.sessionId)).toEqual([
      'new',
      'mid',
      'old',
    ]);
    expect(result.trend.points).toEqual([40, 60, 80]);
    expect(result.trend.direction).toBe('improving');
  });

  it('caps the recent window at five sessions', () => {
    const scored = Array.from({ length: 8 }, (_, i) =>
      fact({
        sessionId: `s${i}`,
        overallPercent: 50 + i,
        scoredAt: `2026-09-0${i + 1}T00:00:00.000Z`,
      }),
    );
    const result = computeProfilePerformance({
      scored,
      abandonedCount: 0,
      mitreTacticsCovered: 0,
    });

    expect(result.recentPerformance).toHaveLength(5);
    expect(result.trend.points).toHaveLength(5);
    expect(result.trend.points).toEqual([53, 54, 55, 56, 57]);
  });

  it('calls a flat run of scores steady, not a trend', () => {
    const result = computeProfilePerformance({
      scored: [
        fact({ overallPercent: 80, scoredAt: '2026-09-01T00:00:00.000Z' }),
        fact({ overallPercent: 81, scoredAt: '2026-09-02T00:00:00.000Z' }),
        fact({ overallPercent: 79, scoredAt: '2026-09-03T00:00:00.000Z' }),
        fact({ overallPercent: 80, scoredAt: '2026-09-04T00:00:00.000Z' }),
      ],
      abandonedCount: 0,
      mitreTacticsCovered: 0,
    });

    expect(result.trend.direction).toBe('steady');
  });

  it('breaks performance down by scenario category, best first', () => {
    const result = computeProfilePerformance({
      scored: [
        fact({ scenarioCategory: 'email', overallPercent: 90 }),
        fact({ scenarioCategory: 'email', overallPercent: 70 }),
        fact({ scenarioCategory: 'identity', overallPercent: 95 }),
      ],
      abandonedCount: 0,
      mitreTacticsCovered: 0,
    });

    expect(result.categoryBreakdown).toEqual([
      { category: 'identity', averagePercent: 95, completed: 1 },
      { category: 'email', averagePercent: 80, completed: 2 },
    ]);
  });

  it('expresses MITRE tactic coverage as a percentage of all 14 tactics', () => {
    const result = computeProfilePerformance({
      scored: [fact()],
      abandonedCount: 0,
      mitreTacticsCovered: 7,
    });

    expect(result.metrics.mitreTacticsCovered).toBe(7);
    expect(result.metrics.mitreTacticCoveragePercent).toBe(50);
  });
});
