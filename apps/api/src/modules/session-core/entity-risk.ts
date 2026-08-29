import type { AlertSeverity, AlertStatus } from '@prisma/client';

// Identity and Device both expose a `riskLevel` column, but the Telemetry Generator writes
// 'none' to every row it creates and nothing ever updates it — so both portals rendered a Risk
// column that always read "none" and an "at risk" tile permanently stuck at 0.
//
// Populating it from the ground truth would flag the compromised host before the student has
// investigated anything, which defeats the exercise. Deriving it from the alerts already firing
// on that entity leaks nothing (those alerts are on screen either way), mirrors how real
// consoles score an asset, and stays responsive to the student's own triage: resolving or
// dismissing an alert lowers the entity's risk, exactly as it should.

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

/** An alert only contributes while it is still open — triaged ones stop counting. */
const OPEN_STATUSES: ReadonlySet<AlertStatus> = new Set<AlertStatus>([
  'new',
  'in_progress',
]);

// Deliberately not a 1:1 severity map: one critical detection should stand out from a host
// carrying a couple of high-severity ones, or the column loses its ability to rank.
const SEVERITY_RISK: Record<AlertSeverity, RiskLevel> = {
  critical: 'high',
  high: 'medium',
  medium: 'low',
  low: 'low',
  informational: 'none',
};

const RISK_ORDER: RiskLevel[] = ['none', 'low', 'medium', 'high'];

export interface RiskContributingAlert {
  primaryEntityId: string;
  severity: AlertSeverity;
  status: AlertStatus;
}

/**
 * Highest risk implied by any still-open alert on each entity. Entities with no open alerts are
 * absent from the map, and callers treat that as 'none'.
 */
export function deriveRiskByEntityId(
  alerts: RiskContributingAlert[],
): Map<string, RiskLevel> {
  const byEntity = new Map<string, RiskLevel>();

  for (const alert of alerts) {
    if (!OPEN_STATUSES.has(alert.status)) continue;
    const risk = SEVERITY_RISK[alert.severity];
    const current = byEntity.get(alert.primaryEntityId) ?? 'none';
    if (RISK_ORDER.indexOf(risk) > RISK_ORDER.indexOf(current)) {
      byEntity.set(alert.primaryEntityId, risk);
    }
  }

  return byEntity;
}
