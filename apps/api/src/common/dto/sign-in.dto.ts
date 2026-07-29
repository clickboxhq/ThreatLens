import type { SignInEvent } from '@prisma/client';

// §18.3: excludes isGroundTruthEvidence, mitreTechniqueId, correlationId (would hand the
// Student the answer or a pre-built connection), and `raw` (carries internal generator tags).
export interface StudentSignInDto {
  id: string;
  occurredAt: Date;
  identityId: string;
  deviceId: string | null;
  sourceIp: string;
  sourceCountry: string;
  sourceCity: string;
  application: string;
  result: string;
  failureReason: string | null;
  isLegacyAuth: boolean;
  clientApp: string;
}

export function toStudentSignInDto(event: SignInEvent): StudentSignInDto {
  return {
    id: event.id,
    occurredAt: event.occurredAt,
    identityId: event.identityId,
    deviceId: event.deviceId,
    sourceIp: event.sourceIp,
    sourceCountry: event.sourceCountry,
    sourceCity: event.sourceCity,
    application: event.application,
    result: event.result,
    failureReason: event.failureReason,
    isLegacyAuth: event.isLegacyAuth,
    clientApp: event.clientApp,
  };
}
