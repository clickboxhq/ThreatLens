import { computeScore, ScoringInput } from './scorer';

function baseInput(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    requiredTechniqueIds: ['T1566.002', 'T1078'],
    taggedTechniqueIds: [],
    totalGroundTruthEvidenceCount: 2,
    pinnedGroundTruthEvidenceCount: 0,
    pinnedTotalEvidenceCount: 0,
    falsePositiveByDesignAlertCount: 2,
    falsePositiveCorrectlyHandledCount: 0,
    falsePositiveMishandledCount: 0,
    containmentExpectationCount: 0,
    containmentMetCount: 0,
    requiredVerdict: 'true_positive',
    submittedVerdicts: [],
    hintPenaltyPercent: 0,
    timeToResolutionSeconds: 600,
    ...overrides,
  };
}

// §12.4's rubric, with the sanity bounds this project's plan specifically called for:
// a perfect investigation scores near 100%, an empty one scores near 0%.
describe('computeScore (§12.4)', () => {
  it('scores near 100% when everything required was correctly identified', () => {
    const result = computeScore(
      baseInput({
        taggedTechniqueIds: ['T1566.002', 'T1078'],
        pinnedGroundTruthEvidenceCount: 2,
        pinnedTotalEvidenceCount: 2,
        falsePositiveCorrectlyHandledCount: 2,
        submittedVerdicts: ['true_positive'],
      }),
    );

    expect(result.overallPercent).toBeGreaterThanOrEqual(95);
    expect(result.verdictCorrect).toBe(true);
    expect(result.evidenceRecallPercent).toBe(100);
    expect(result.evidencePrecisionPercent).toBe(100);
  });

  it('scores near 0% when nothing was identified or pinned', () => {
    const result = computeScore(baseInput());

    expect(result.overallPercent).toBeLessThanOrEqual(15);
    expect(result.verdictCorrect).toBe(false);
    expect(result.techniqueAccuracyPercent).toBe(0);
  });

  it('penalizes tagging extra, incorrect techniques (precision matters, not just recall)', () => {
    const preciseOnly = computeScore(baseInput({ taggedTechniqueIds: ['T1566.002', 'T1078'] }));
    const overTagged = computeScore(
      baseInput({ taggedTechniqueIds: ['T1566.002', 'T1078', 'T1110', 'T1621', 'T1566.001'] }),
    );

    expect(overTagged.techniqueAccuracyPercent).toBeLessThan(preciseOnly.techniqueAccuracyPercent);
  });

  it('penalizes escalating or pinning false-positive-by-design alerts', () => {
    const clean = computeScore(baseInput({ falsePositiveCorrectlyHandledCount: 2, falsePositiveMishandledCount: 0 }));
    const mishandled = computeScore(baseInput({ falsePositiveCorrectlyHandledCount: 0, falsePositiveMishandledCount: 2 }));

    expect(mishandled.falsePositiveHandlingPercent).toBeLessThan(clean.falsePositiveHandlingPercent);
    expect(clean.falsePositiveHandlingPercent).toBe(100);
    expect(mishandled.falsePositiveHandlingPercent).toBe(0);
  });

  it('does not reward inaction: never touching the false-positive bait scores 0 on that component', () => {
    const result = computeScore(baseInput({ falsePositiveCorrectlyHandledCount: 0, falsePositiveMishandledCount: 0 }));
    expect(result.falsePositiveHandlingPercent).toBe(0);
  });

  it('deducts the hint penalty from the final overall percent', () => {
    const withoutHints = computeScore(
      baseInput({
        taggedTechniqueIds: ['T1566.002', 'T1078'],
        pinnedGroundTruthEvidenceCount: 2,
        pinnedTotalEvidenceCount: 2,
        submittedVerdicts: ['true_positive'],
        hintPenaltyPercent: 0,
      }),
    );
    const withHints = computeScore(
      baseInput({
        taggedTechniqueIds: ['T1566.002', 'T1078'],
        pinnedGroundTruthEvidenceCount: 2,
        pinnedTotalEvidenceCount: 2,
        submittedVerdicts: ['true_positive'],
        hintPenaltyPercent: 15,
      }),
    );

    expect(withHints.overallPercent).toBeCloseTo(withoutHints.overallPercent - 15, 1);
  });

  it('never returns a percent outside [0, 100]', () => {
    const result = computeScore(baseInput({ hintPenaltyPercent: 500 }));
    expect(result.overallPercent).toBeGreaterThanOrEqual(0);
    expect(result.overallPercent).toBeLessThanOrEqual(100);
  });
});
