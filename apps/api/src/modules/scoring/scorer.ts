// Pure rubric math (§12.4) — a function of already-fetched facts about a session, with no
// I/O, so it is exactly unit-testable and the one place score correctness can be verified
// without a database.

export interface ScoringInput {
  requiredTechniqueIds: string[];
  taggedTechniqueIds: string[];
  totalGroundTruthEvidenceCount: number;
  pinnedGroundTruthEvidenceCount: number;
  pinnedTotalEvidenceCount: number;

  // Triage (§8.6, §12.4 component 3). Every alert the session raised falls into exactly one
  // of: escalated into the incident, dismissed with a reason, or left alone. A "real" alert
  // is one whose evidence includes at least one ground-truth event; "bait" is one whose
  // evidence is entirely noise (isFalsePositiveByDesign).
  alertCount: number;
  realAlertsEscalated: number;
  realAlertsDismissed: number;
  baitAlertsDismissed: number;
  /** Bait that was escalated, or whose evidence was pinned — either sweeps noise in. */
  baitAlertsMishandled: number;

  // Containment (§12.4 component 4). An expectation is met when the named action was taken
  // against the named entity before submission. `by_relative_time` and `weight` from the
  // rubric schema (§12.1) are deliberately not scored yet — there is no live/time-phased mode
  // (§12.7) for a deadline to be relative to, and equal weighting is what every authored
  // scenario currently assumes.
  containmentExpectationCount: number;
  containmentMetCount: number;
  /** Containment actions taken when the rubric expected none at all. */
  unnecessaryContainmentCount: number;

  requiredVerdict: string;
  submittedVerdicts: string[];
  hintPenaltyPercent: number;
  timeToResolutionSeconds: number;
}

export interface RubricBreakdown {
  techniqueAccuracyPercent: number;
  evidencePrecisionPercent: number;
  evidenceRecallPercent: number;
  triageAccuracyPercent: number;
  /** Bait alerts swept into the investigation. Persisted as scores.false_positive_count. */
  falsePositiveCount: number;
  responsePercent: number;
  verdictCorrect: boolean;
  overallPercent: number;
}

const WEIGHTS = {
  technique: 0.3,
  evidence: 0.3,
  triage: 0.15,
  response: 0.15,
  verdict: 0.1,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function computeScore(input: ScoringInput): RubricBreakdown {
  const requiredSet = new Set(input.requiredTechniqueIds);
  const taggedSet = new Set(input.taggedTechniqueIds);
  const matched = [...requiredSet].filter((t) => taggedSet.has(t)).length;

  const techniquePrecision =
    taggedSet.size > 0
      ? matched / taggedSet.size
      : requiredSet.size === 0
        ? 1
        : 0;
  const techniqueRecall = requiredSet.size > 0 ? matched / requiredSet.size : 1;
  const techniqueAccuracyPercent =
    ((techniquePrecision + techniqueRecall) / 2) * 100;

  const evidencePrecisionPercent =
    input.pinnedTotalEvidenceCount > 0
      ? (input.pinnedGroundTruthEvidenceCount /
          input.pinnedTotalEvidenceCount) *
        100
      : 0;
  const evidenceRecallPercent =
    input.totalGroundTruthEvidenceCount > 0
      ? (input.pinnedGroundTruthEvidenceCount /
          input.totalGroundTruthEvidenceCount) *
        100
      : 100;
  const evidenceComponentPercent =
    (evidencePrecisionPercent + evidenceRecallPercent) / 2;

  // Triage accuracy: right decisions minus wrong ones, over every alert raised. Escalating a
  // real alert and dismissing bait with a reason both count for; dismissing a real alert and
  // sweeping bait in both count against. An alert never acted on counts for neither — but it
  // still sits in the denominator, so inaction is not scoreable as good triage. A scenario
  // with no alerts has nothing to triage and scores full marks here.
  const triageCorrect = input.realAlertsEscalated + input.baitAlertsDismissed;
  const triageIncorrect =
    input.realAlertsDismissed + input.baitAlertsMishandled;
  const triageAccuracyPercent =
    input.alertCount > 0
      ? clampPercent(
          ((triageCorrect - triageIncorrect) / input.alertCount) * 100,
        )
      : 100;

  // Response: the fraction of expected containment taken against the right target. On a false
  // or benign positive the correct response is no action, and taking one is the
  // over-containment the investigation checklist warns about: it scores zero, not a discount.
  // The zero keys on the verdict, not on the expectation list being empty: a true positive
  // whose rubric lists no containment (a version published before expectations were authored,
  // which in-flight sessions stay pinned to, or a builder scenario that left them out) has
  // nothing to measure against, so it scores full marks rather than punishing a reasonable
  // isolate. Extra actions where containment is expected are reported in the debrief but not
  // penalised here.
  const overContained =
    input.requiredVerdict !== 'true_positive' &&
    input.unnecessaryContainmentCount > 0;
  const responsePercent =
    input.containmentExpectationCount > 0
      ? (input.containmentMetCount / input.containmentExpectationCount) * 100
      : overContained
        ? 0
        : 100;

  const verdictCorrect = input.submittedVerdicts.includes(
    input.requiredVerdict,
  );

  const weightedSum =
    techniqueAccuracyPercent * WEIGHTS.technique +
    evidenceComponentPercent * WEIGHTS.evidence +
    triageAccuracyPercent * WEIGHTS.triage +
    responsePercent * WEIGHTS.response +
    (verdictCorrect ? 100 : 0) * WEIGHTS.verdict;

  const overallPercent = clampPercent(weightedSum - input.hintPenaltyPercent);

  return {
    techniqueAccuracyPercent: round2(techniqueAccuracyPercent),
    evidencePrecisionPercent: round2(evidencePrecisionPercent),
    evidenceRecallPercent: round2(evidenceRecallPercent),
    triageAccuracyPercent: round2(triageAccuracyPercent),
    falsePositiveCount: input.baitAlertsMishandled,
    responsePercent: round2(responsePercent),
    verdictCorrect,
    overallPercent: round2(overallPercent),
  };
}
