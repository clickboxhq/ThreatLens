import { computeScore, ScoringInput } from './scorer';

function baseInput(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    requiredTechniqueIds: ['T1566.002', 'T1078'],
    taggedTechniqueIds: [],
    totalGroundTruthEvidenceCount: 2,
    pinnedGroundTruthEvidenceCount: 0,
    pinnedTotalEvidenceCount: 0,
    alertCount: 4,
    realAlertsEscalated: 0,
    realAlertsDismissed: 0,
    baitAlertsDismissed: 0,
    baitAlertsMishandled: 0,
    containmentExpectationCount: 2,
    containmentMetCount: 0,
    unnecessaryContainmentCount: 0,
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
  it('scores 100% when everything required was correctly identified', () => {
    const result = computeScore(
      baseInput({
        taggedTechniqueIds: ['T1566.002', 'T1078'],
        pinnedGroundTruthEvidenceCount: 2,
        pinnedTotalEvidenceCount: 2,
        realAlertsEscalated: 2,
        baitAlertsDismissed: 2,
        containmentMetCount: 2,
        submittedVerdicts: ['true_positive'],
      }),
    );

    expect(result.overallPercent).toBe(100);
    expect(result.verdictCorrect).toBe(true);
    expect(result.evidenceRecallPercent).toBe(100);
    expect(result.evidencePrecisionPercent).toBe(100);
    expect(result.triageAccuracyPercent).toBe(100);
    expect(result.responsePercent).toBe(100);
  });

  it('scores 0% when nothing was identified, pinned, triaged or contained', () => {
    const result = computeScore(baseInput());

    expect(result.overallPercent).toBe(0);
    expect(result.verdictCorrect).toBe(false);
    expect(result.techniqueAccuracyPercent).toBe(0);
    expect(result.triageAccuracyPercent).toBe(0);
    expect(result.responsePercent).toBe(0);
  });

  it('penalizes tagging extra, incorrect techniques (precision matters, not just recall)', () => {
    const preciseOnly = computeScore(
      baseInput({ taggedTechniqueIds: ['T1566.002', 'T1078'] }),
    );
    const overTagged = computeScore(
      baseInput({
        taggedTechniqueIds: [
          'T1566.002',
          'T1078',
          'T1110',
          'T1621',
          'T1566.001',
        ],
      }),
    );

    expect(overTagged.techniqueAccuracyPercent).toBeLessThan(
      preciseOnly.techniqueAccuracyPercent,
    );
  });

  describe('triage accuracy (§8.6, component 3)', () => {
    it('credits escalating real alerts and dismissing bait equally', () => {
      const escalatedOnly = computeScore(baseInput({ realAlertsEscalated: 2 }));
      const dismissedOnly = computeScore(baseInput({ baitAlertsDismissed: 2 }));
      expect(escalatedOnly.triageAccuracyPercent).toBe(50);
      expect(dismissedOnly.triageAccuracyPercent).toBe(50);
    });

    it('charges dismissing a real alert and sweeping bait in equally', () => {
      const perfect = computeScore(
        baseInput({ realAlertsEscalated: 2, baitAlertsDismissed: 2 }),
      );
      const dismissedReal = computeScore(
        baseInput({
          realAlertsEscalated: 1,
          realAlertsDismissed: 1,
          baitAlertsDismissed: 2,
        }),
      );
      const sweptBait = computeScore(
        baseInput({
          realAlertsEscalated: 2,
          baitAlertsDismissed: 1,
          baitAlertsMishandled: 1,
        }),
      );
      expect(perfect.triageAccuracyPercent).toBe(100);
      // One right decision became one wrong one: net swing of two over four alerts.
      expect(dismissedReal.triageAccuracyPercent).toBe(50);
      expect(sweptBait.triageAccuracyPercent).toBe(50);
    });

    it('does not reward inaction: alerts never acted on earn nothing but still count', () => {
      const untouched = computeScore(baseInput());
      const halfDone = computeScore(
        baseInput({ realAlertsEscalated: 1, baitAlertsDismissed: 1 }),
      );
      expect(untouched.triageAccuracyPercent).toBe(0);
      expect(halfDone.triageAccuracyPercent).toBe(50);
    });

    it('cannot go below zero however wrong the decisions were', () => {
      const result = computeScore(
        baseInput({ realAlertsDismissed: 2, baitAlertsMishandled: 2 }),
      );
      expect(result.triageAccuracyPercent).toBe(0);
    });

    it('scores full marks when the session raised no alerts to triage', () => {
      const result = computeScore(baseInput({ alertCount: 0 }));
      expect(result.triageAccuracyPercent).toBe(100);
    });

    it('reports swept-in bait as the persisted false-positive count', () => {
      const result = computeScore(baseInput({ baitAlertsMishandled: 3 }));
      expect(result.falsePositiveCount).toBe(3);
    });
  });

  describe('response (component 4)', () => {
    it('is the fraction of expected containment taken against the right target', () => {
      expect(
        computeScore(baseInput({ containmentMetCount: 1 })).responsePercent,
      ).toBe(50);
      expect(
        computeScore(baseInput({ containmentMetCount: 2 })).responsePercent,
      ).toBe(100);
    });

    it('does not penalise extra actions when the rubric does expect containment', () => {
      const result = computeScore(
        baseInput({ containmentMetCount: 2, unnecessaryContainmentCount: 3 }),
      );
      expect(result.responsePercent).toBe(100);
    });

    it('scores full marks for taking no action when none was expected', () => {
      const result = computeScore(
        baseInput({
          containmentExpectationCount: 0,
          requiredVerdict: 'benign_positive',
        }),
      );
      expect(result.responsePercent).toBe(100);
    });

    it('scores zero for over-containment: any action when none was expected', () => {
      const result = computeScore(
        baseInput({
          containmentExpectationCount: 0,
          unnecessaryContainmentCount: 1,
          requiredVerdict: 'benign_positive',
        }),
      );
      expect(result.responsePercent).toBe(0);
    });
  });

  it('deducts the hint penalty from the final overall percent', () => {
    const full = {
      taggedTechniqueIds: ['T1566.002', 'T1078'],
      pinnedGroundTruthEvidenceCount: 2,
      pinnedTotalEvidenceCount: 2,
      realAlertsEscalated: 2,
      baitAlertsDismissed: 2,
      containmentMetCount: 2,
      submittedVerdicts: ['true_positive'],
    };
    const withoutHints = computeScore(
      baseInput({ ...full, hintPenaltyPercent: 0 }),
    );
    const withHints = computeScore(
      baseInput({ ...full, hintPenaltyPercent: 15 }),
    );

    expect(withHints.overallPercent).toBeCloseTo(
      withoutHints.overallPercent - 15,
      1,
    );
  });

  it('never returns a percent outside [0, 100]', () => {
    const result = computeScore(baseInput({ hintPenaltyPercent: 500 }));
    expect(result.overallPercent).toBeGreaterThanOrEqual(0);
    expect(result.overallPercent).toBeLessThanOrEqual(100);
  });
});
