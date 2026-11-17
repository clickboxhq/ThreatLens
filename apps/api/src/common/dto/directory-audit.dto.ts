import type { DirectoryAuditEvent } from '@prisma/client';

// §18.3: excludes isGroundTruthEvidence, mitreTechniqueId, correlationId — same rule as every
// other telemetry DTO. The whole point of this table is that the Student decides which entry
// is suspicious; shipping the answer alongside it would defeat the exercise.
export interface StudentDirectoryAuditDto {
  id: string;
  occurredAt: Date;
  targetIdentityId: string;
  actorIdentityId: string | null;
  actorDisplayName: string;
  category: string;
  action: string;
  result: string;
  detail: unknown;
  sourceIp: string;
}

/**
 * One line describing a directory change, shared by everywhere a pinned or missed one is
 * named — the evidence list, the debrief, the timeline — so all three say the same thing.
 * Reads only fields a Student can already see in the audit trail.
 */
export function describeDirectoryAuditEvent(
  event: Pick<
    DirectoryAuditEvent,
    'action' | 'actorDisplayName' | 'sourceIp' | 'detail'
  >,
  targetName: string,
): string {
  const d =
    event.detail &&
    typeof event.detail === 'object' &&
    !Array.isArray(event.detail)
      ? (event.detail as Record<string, unknown>)
      : {};
  const specifics = [
    d.group && `group ${String(d.group)}`,
    d.role && `role ${String(d.role)}`,
    d.ruleName && `rule "${String(d.ruleName)}"`,
    d.forwardTo && `forwarding to ${String(d.forwardTo)}`,
    d.method && String(d.method),
  ].filter(Boolean);
  const what = specifics.length ? ` (${specifics.join(', ')})` : '';
  return `${event.action} on ${targetName}${what} by ${event.actorDisplayName} from ${event.sourceIp}`;
}

export function toStudentDirectoryAuditDto(
  event: DirectoryAuditEvent,
): StudentDirectoryAuditDto {
  return {
    id: event.id,
    occurredAt: event.occurredAt,
    targetIdentityId: event.targetIdentityId,
    actorIdentityId: event.actorIdentityId,
    actorDisplayName: event.actorDisplayName,
    category: event.category,
    action: event.action,
    result: event.result,
    detail: event.detail,
    sourceIp: event.sourceIp,
  };
}
