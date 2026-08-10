import type { CloudEvent } from '@prisma/client';

// §18.3: excludes isGroundTruthEvidence, mitreTechniqueId, correlationId, raw (§6.12.8).
export interface StudentCloudEventDto {
  id: string;
  occurredAt: Date;
  identityId: string;
  provider: string;
  actionName: string;
  resourceId: string | null;
  sourceIp: string;
}

export function toStudentCloudEventDto(
  event: CloudEvent,
): StudentCloudEventDto {
  return {
    id: event.id,
    occurredAt: event.occurredAt,
    identityId: event.identityId,
    provider: event.provider,
    actionName: event.actionName,
    resourceId: event.resourceId,
    sourceIp: event.sourceIp,
  };
}
