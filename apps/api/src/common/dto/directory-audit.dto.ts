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
