import type { Alert, MitreTechnique } from '@prisma/client';

// §18.3: excludes isFalsePositiveByDesign, detectionRuleId and relatedAlertId (internal-only,
// §8.6). relatedAlertId is the generator's own correlation grouping re-keyed by alert id — which
// alerts belong to the same chain is exactly what a student is asked to work out in triage, so
// handing it over made correlation a reveal rather than a skill. It is shown once the session
// is scored, in the debrief. The alert's own MITRE technique IS shown — that's normal triage
// information, distinct from the ground-truth flags on raw event rows (§16.5).
export interface StudentAlertDto {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  dismissalReason: string | null;
  primaryEntityType: string;
  primaryEntityId: string;
  mitreTechnique: { id: string; techniqueId: string; name: string } | null;
  dedupCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export function toStudentAlertDto(
  alert: Alert & { mitreTechnique?: MitreTechnique | null },
): StudentAlertDto {
  return {
    id: alert.id,
    title: alert.title,
    description: alert.description,
    severity: alert.severity,
    status: alert.status,
    dismissalReason: alert.dismissalReason,
    primaryEntityType: alert.primaryEntityType,
    primaryEntityId: alert.primaryEntityId,
    mitreTechnique: alert.mitreTechnique
      ? {
          id: alert.mitreTechnique.id,
          techniqueId: alert.mitreTechnique.techniqueId,
          name: alert.mitreTechnique.name,
        }
      : null,
    dedupCount: alert.dedupCount,
    firstSeenAt: alert.firstSeenAt,
    lastSeenAt: alert.lastSeenAt,
  };
}
