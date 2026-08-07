import { computeSkillRadar, SessionTechniqueOutcome } from './skill-radar';

const TACTIC_MAP = new Map([
  ['T1566.002', 'TA0001'], // Initial Access
  ['T1078', 'TA0001'],
  ['T1110.003', 'TA0006'], // Credential Access
  ['T1558.003', 'TA0006'],
  ['T1486', 'TA0040'], // Impact
]);

function outcome(overrides: Partial<SessionTechniqueOutcome> = {}): SessionTechniqueOutcome {
  return { requiredTechniqueIds: [], taggedTechniqueIds: [], ...overrides };
}

describe('computeSkillRadar (§2.17, §13.2)', () => {
  it('computes hit/required counts and percent per tactic across multiple sessions', () => {
    const sessions = [
      outcome({ requiredTechniqueIds: ['T1566.002'], taggedTechniqueIds: ['T1566.002'] }), // Initial Access: hit
      outcome({ requiredTechniqueIds: ['T1078'], taggedTechniqueIds: [] }), // Initial Access: miss
      outcome({ requiredTechniqueIds: ['T1110.003'], taggedTechniqueIds: ['T1110.003'] }), // Credential Access: hit
    ];

    const result = computeSkillRadar(sessions, TACTIC_MAP);
    const initialAccess = result.find((r) => r.tactic === 'TA0001')!;
    const credentialAccess = result.find((r) => r.tactic === 'TA0006')!;

    expect(initialAccess.requiredCount).toBe(2);
    expect(initialAccess.hitCount).toBe(1);
    expect(initialAccess.percent).toBe(50);
    expect(initialAccess.tacticName).toBe('Initial Access');

    expect(credentialAccess.requiredCount).toBe(1);
    expect(credentialAccess.hitCount).toBe(1);
    expect(credentialAccess.percent).toBe(100);
  });

  it('omits tactics with zero required-technique instances entirely', () => {
    const sessions = [outcome({ requiredTechniqueIds: ['T1566.002'], taggedTechniqueIds: ['T1566.002'] })];
    const result = computeSkillRadar(sessions, TACTIC_MAP);

    expect(result.some((r) => r.tactic === 'TA0040')).toBe(false); // Impact never required
    expect(result).toHaveLength(1);
  });

  it('returns tactics in canonical kill-chain order, not session order', () => {
    const sessions = [
      outcome({ requiredTechniqueIds: ['T1486'], taggedTechniqueIds: ['T1486'] }), // Impact (late in chain)
      outcome({ requiredTechniqueIds: ['T1566.002'], taggedTechniqueIds: [] }), // Initial Access (early in chain)
    ];

    const result = computeSkillRadar(sessions, TACTIC_MAP);
    expect(result.map((r) => r.tactic)).toEqual(['TA0001', 'TA0040']);
  });

  it('ignores technique IDs with no known tactic mapping', () => {
    const sessions = [outcome({ requiredTechniqueIds: ['T9999.999'], taggedTechniqueIds: ['T9999.999'] })];
    expect(computeSkillRadar(sessions, TACTIC_MAP)).toHaveLength(0);
  });

  it('returns an empty array for no sessions', () => {
    expect(computeSkillRadar([], TACTIC_MAP)).toHaveLength(0);
  });

  it('does not count a tagged technique that was never required', () => {
    // Tagging an extra, unrequired technique should not inflate any tactic's hit count.
    const sessions = [outcome({ requiredTechniqueIds: ['T1566.002'], taggedTechniqueIds: ['T1566.002', 'T1110.003'] })];
    const result = computeSkillRadar(sessions, TACTIC_MAP);

    expect(result).toHaveLength(1);
    expect(result[0].tactic).toBe('TA0001');
    expect(result[0].hitCount).toBe(1);
  });
});
