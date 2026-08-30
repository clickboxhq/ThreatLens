import type {
  Device,
  FileEvent,
  HttpRequest,
  NetworkEvent,
  ProcessEvent,
} from '@prisma/client';

// §18.3: excludes isGroundTruthActor.
export interface StudentDeviceDto {
  id: string;
  hostname: string;
  osPlatform: string;
  osVersion: string;
  primaryIdentityId: string | null;
  riskLevel: string;
  isolationStatus: string;
  lastSeenAt: Date;
}

export function toStudentDeviceDto(device: Device): StudentDeviceDto {
  return {
    id: device.id,
    hostname: device.hostname,
    osPlatform: device.osPlatform,
    osVersion: device.osVersion,
    primaryIdentityId: device.primaryIdentityId,
    riskLevel: device.riskLevel,
    isolationStatus: device.isolationStatus,
    lastSeenAt: device.lastSeenAt,
  };
}

// §18.3: excludes isGroundTruthEvidence, mitreTechniqueId, correlationId, raw (§10.3).
export interface StudentProcessEventDto {
  id: string;
  occurredAt: Date;
  deviceId: string;
  processGuid: string;
  parentProcessGuid: string | null;
  imagePath: string;
  commandLine: string;
  hashSha256: string;
  parentImagePath: string | null;
  integrityLevel: string;
  identityId: string | null;
}

export function toStudentProcessEventDto(
  event: ProcessEvent,
): StudentProcessEventDto {
  return {
    id: event.id,
    occurredAt: event.occurredAt,
    deviceId: event.deviceId,
    processGuid: event.processGuid,
    parentProcessGuid: event.parentProcessGuid,
    imagePath: event.imagePath,
    commandLine: event.commandLine,
    hashSha256: event.hashSha256,
    parentImagePath: event.parentImagePath,
    integrityLevel: event.integrityLevel,
    identityId: event.identityId,
  };
}

export interface StudentFileEventDto {
  id: string;
  occurredAt: Date;
  deviceId: string;
  action: string;
  filePath: string;
  hashSha256: string | null;
  processGuid: string | null;
}

export function toStudentFileEventDto(event: FileEvent): StudentFileEventDto {
  return {
    id: event.id,
    occurredAt: event.occurredAt,
    deviceId: event.deviceId,
    action: event.action,
    filePath: event.filePath,
    hashSha256: event.hashSha256,
    processGuid: event.processGuid,
  };
}

export interface StudentNetworkEventDto {
  id: string;
  occurredAt: Date;
  deviceId: string;
  direction: string;
  protocol: string;
  localPort: number;
  remoteIp: string;
  remotePort: number;
  bytesSent: number;
  bytesReceived: number;
  processGuid: string | null;
}

export function toStudentNetworkEventDto(
  event: NetworkEvent,
): StudentNetworkEventDto {
  return {
    id: event.id,
    occurredAt: event.occurredAt,
    deviceId: event.deviceId,
    direction: event.direction,
    protocol: event.protocol,
    localPort: event.localPort,
    remoteIp: event.remoteIp,
    remotePort: event.remotePort,
    bytesSent: event.bytesSent,
    bytesReceived: event.bytesReceived,
    processGuid: event.processGuid,
  };
}

export interface StudentHttpRequestDto {
  id: string;
  occurredAt: Date;
  deviceId: string | null;
  // Who made the request. Withholding this made the IDOR scenario unanswerable — its entire
  // finding is that a *named, authenticated* user read records belonging to other people, and
  // without attribution the traffic is indistinguishable from a scheduled job.
  identityId: string | null;
  method: string;
  url: string;
  userAgent: string;
  statusCode: number;
  sourceIp: string;
}

export function toStudentHttpRequestDto(
  event: HttpRequest,
): StudentHttpRequestDto {
  return {
    id: event.id,
    occurredAt: event.occurredAt,
    deviceId: event.deviceId,
    identityId: event.identityId,
    method: event.method,
    url: event.url,
    userAgent: event.userAgent,
    statusCode: event.statusCode,
    sourceIp: event.sourceIp,
  };
}
