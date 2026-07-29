// Pure rubric math (§12.4) — a function of already-fetched facts about a session, with no
// I/O, so it is exactly unit-testable and the one place score correctness can be verified
// without a database.

export interface ScoringInput {
  requiredTechniqueIds: string[];
  taggedTechniqueIds: string[];
  totalGroundTruthEvidenceCount: number;
  pinnedGroundTruthEvidenceCount: number;
  pinnedTotalEvidenceCount: number;
  falsePositiveByDesignAlertCount: number;
  falsePositiveCorrectlyHandledCount: number;
  falsePositiveMishandledCount: number;
  containmentExpectationCount: number;
  containmentMetCount: number;
  requiredVerdict: string;
  submittedVerdicts: string[];
  hintPenaltyPercent: number;
  timeToResolutionSeconds: number;
}

export interface RubricBreakdown {
  techniqueAccuracyPercent: number;
  evidencePrecisionPercent: number;
  evidenceRecallPercent: number;
  falsePositiveHandlingPercent: number;
  falsePositiveCount: number;
  responsePercent: number;
  verdictCorrect: boolean;
  overallPercent: number;
}

const WEIGHTS = {
  technique: 0.3,
  evidence: 0.3,
  falsePositive: 0.15,
  response: 0.15,
  verdict: 0.1,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeScore(input: ScoringInput): RubricBreakdown {
  const requiredSet = new Set(input.requiredTechniqueIds);
  const taggedSet = new Set(input.taggedTechniqueIds);
  const matched = [...requiredSet].filter((t) => taggedSet.has(t)).length;

  const techniquePrecision = taggedSet.size > 0 ? matched / taggedSet.size : requiredSet.size === 0 ? 1 : 0;
  const techniqueRecall = requiredSet.size > 0 ? matched / requiredSet.size : 1;
  const techniqueAccuracyPercent = ((techniquePrecision + techniqueRecall) / 2) * 100;

  const evidencePrecisionPercent =
    input.pinnedTotalEvidenceCount > 0 ? (input.pinnedGroundTruthEvidenceCount / input.pinnedTotalEvidenceCount) * 100 : 0;
  const evidenceRecallPercent =
    input.totalGroundTruthEvidenceCount > 0
      ? (input.pinnedGroundTruthEvidenceCount / input.totalGroundTruthEvidenceCount) * 100
      : 100;
  const evidenceComponentPercent = (evidencePrecisionPercent + evidenceRecallPercent) / 2;

  // Rewards correctly dismissing false-positive bait, penalizes escalating/pinning it as
  // evidence — and, deliberately, does NOT default to a high score for simply never
  // touching those alerts. Inaction must not be scoreable as good false-positive handling.
  const falsePositiveHandlingPercent =
    input.falsePositiveByDesignAlertCount > 0
      ? Math.max(
          0,
          Math.min(
            100,
            ((input.falsePositiveCorrectlyHandledCount - input.falsePositiveMishandledCount) /
              input.falsePositiveByDesignAlertCount) *
              100,
          ),
        )
      : 100;

  const responsePercent =
    input.containmentExpectationCount > 0 ? (input.containmentMetCount / input.containmentExpectationCount) * 100 : 100;

  const verdictCorrect = input.submittedVerdicts.includes(input.requiredVerdict);

  const weightedSum =
    techniqueAccuracyPercent * WEIGHTS.technique +
    evidenceComponentPercent * WEIGHTS.evidence +
    falsePositiveHandlingPercent * WEIGHTS.falsePositive +
    responsePercent * WEIGHTS.response +
    (verdictCorrect ? 100 : 0) * WEIGHTS.verdict;

  const overallPercent = Math.max(0, Math.min(100, weightedSum - input.hintPenaltyPercent));

  return {
    techniqueAccuracyPercent: round2(techniqueAccuracyPercent),
    evidencePrecisionPercent: round2(evidencePrecisionPercent),
    evidenceRecallPercent: round2(evidenceRecallPercent),
    falsePositiveHandlingPercent: round2(falsePositiveHandlingPercent),
    falsePositiveCount: input.falsePositiveMishandledCount,
    responsePercent: round2(responsePercent),
    verdictCorrect,
    overallPercent: round2(overallPercent),
  };
}
