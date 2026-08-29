import { deriveRiskByEntityId } from './entity-risk';
import type { RiskContributingAlert } from './entity-risk';

const alert = (
  over: Partial<RiskContributingAlert> = {},
): RiskContributingAlert => ({
  primaryEntityId: 'entity-1',
  severity: 'high',
  status: 'new',
  ...over,
});

describe('deriveRiskByEntityId', () => {
  it('omits entities with no open alerts, so callers render them as "none"', () => {
    expect(deriveRiskByEntityId([]).size).toBe(0);
  });

  it('ranks a critical detection above a high one, so the worst host stands out', () => {
    const risk = deriveRiskByEntityId([
      alert({ primaryEntityId: 'a', severity: 'critical' }),
      alert({ primaryEntityId: 'b', severity: 'high' }),
    ]);
    expect(risk.get('a')).toBe('high');
    expect(risk.get('b')).toBe('medium');
  });

  it('takes the highest severity when an entity has several open alerts', () => {
    const risk = deriveRiskByEntityId([
      alert({ severity: 'low' }),
      alert({ severity: 'critical' }),
      alert({ severity: 'medium' }),
    ]);
    expect(risk.get('entity-1')).toBe('high');
  });

  // The point of deriving this from alerts rather than ground truth: it responds to the
  // student's own triage instead of pre-announcing the answer.
  it('stops counting an alert once it is resolved or dismissed', () => {
    expect(
      deriveRiskByEntityId([
        alert({ severity: 'critical', status: 'resolved' }),
      ]).size,
    ).toBe(0);
    expect(
      deriveRiskByEntityId([
        alert({ severity: 'critical', status: 'dismissed' }),
      ]).size,
    ).toBe(0);
  });

  it('keeps risk from the still-open alert when another on the same entity is triaged', () => {
    const risk = deriveRiskByEntityId([
      alert({ severity: 'critical', status: 'resolved' }),
      alert({ severity: 'medium', status: 'in_progress' }),
    ]);
    expect(risk.get('entity-1')).toBe('low');
  });

  it('treats informational alerts as carrying no risk', () => {
    expect(
      deriveRiskByEntityId([alert({ severity: 'informational' })]).size,
    ).toBe(0);
  });
});
