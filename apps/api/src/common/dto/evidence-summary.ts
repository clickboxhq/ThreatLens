import { PrismaService } from '../../prisma/prisma.service';
import { toStudentEmailDto } from './email.dto';
import { toStudentSignInDto } from './sign-in.dto';
import { toStudentProcessEventDto, toStudentFileEventDto, toStudentNetworkEventDto, toStudentHttpRequestDto } from './device.dto';
import { toStudentCloudEventDto } from './cloud.dto';

export interface EvidenceRefSummary {
  eventTable: string;
  eventId: string;
  occurredAt: Date | null;
  summary: string;
  detail: unknown;
}

// Shared by the alert-evidence candidate list (§2.1) and the results-screen missed-evidence
// debrief (§2.12) — one place that knows how to turn a bare {eventTable, eventId} pointer
// into a Student-safe, human-readable summary, for every table an evidenceRef can point at
// (§18.3: routes every field through the same toStudentXxxDto allow-lists either way).
export async function summarizeEvidenceRef(
  prisma: PrismaService,
  eventTable: string,
  eventId: string,
): Promise<EvidenceRefSummary> {
  if (eventTable === 'email_messages') {
    const email = await prisma.emailMessage.findUnique({ where: { id: eventId }, include: { attachments: true, urls: true } });
    return {
      eventTable,
      eventId,
      occurredAt: email?.occurredAt ?? null,
      summary: email ? `Email from "${email.senderAddress}": "${email.subject}"` : 'Event no longer available.',
      detail: email ? toStudentEmailDto(email) : null,
    };
  }

  if (eventTable === 'sign_in_events') {
    const event = await prisma.signInEvent.findUnique({ where: { id: eventId } });
    return {
      eventTable,
      eventId,
      occurredAt: event?.occurredAt ?? null,
      summary: event ? `Sign-in from ${event.sourceCity}, ${event.sourceCountry} to "${event.application}"` : 'Event no longer available.',
      detail: event ? toStudentSignInDto(event) : null,
    };
  }

  if (eventTable === 'process_events') {
    const event = await prisma.processEvent.findUnique({ where: { id: eventId } });
    const device = event ? await prisma.device.findUnique({ where: { id: event.deviceId } }) : null;
    const imageName = event?.imagePath.split(/[\\/]/).pop() ?? '';
    return {
      eventTable,
      eventId,
      occurredAt: event?.occurredAt ?? null,
      summary: event ? `Process "${imageName}" launched on ${device?.hostname ?? 'a device'}` : 'Event no longer available.',
      detail: event ? toStudentProcessEventDto(event) : null,
    };
  }

  if (eventTable === 'file_events') {
    const event = await prisma.fileEvent.findUnique({ where: { id: eventId } });
    const device = event ? await prisma.device.findUnique({ where: { id: event.deviceId } }) : null;
    return {
      eventTable,
      eventId,
      occurredAt: event?.occurredAt ?? null,
      summary: event ? `File ${event.action} on ${device?.hostname ?? 'a device'}: ${event.filePath}` : 'Event no longer available.',
      detail: event ? toStudentFileEventDto(event) : null,
    };
  }

  if (eventTable === 'network_events') {
    const event = await prisma.networkEvent.findUnique({ where: { id: eventId } });
    const device = event ? await prisma.device.findUnique({ where: { id: event.deviceId } }) : null;
    return {
      eventTable,
      eventId,
      occurredAt: event?.occurredAt ?? null,
      summary: event
        ? `${event.direction} connection on ${device?.hostname ?? 'a device'} to ${event.remoteIp}:${event.remotePort}`
        : 'Event no longer available.',
      detail: event ? toStudentNetworkEventDto(event) : null,
    };
  }

  if (eventTable === 'cloud_events') {
    const event = await prisma.cloudEvent.findUnique({ where: { id: eventId }, include: { identity: true } });
    return {
      eventTable,
      eventId,
      occurredAt: event?.occurredAt ?? null,
      summary: event
        ? `Cloud action "${event.actionName}" by ${event.identity.displayName} on "${event.resourceId ?? 'unknown resource'}"`
        : 'Event no longer available.',
      detail: event ? toStudentCloudEventDto(event) : null,
    };
  }

  if (eventTable === 'http_requests') {
    const event = await prisma.httpRequest.findUnique({ where: { id: eventId } });
    const device = event?.deviceId ? await prisma.device.findUnique({ where: { id: event.deviceId } }) : null;
    return {
      eventTable,
      eventId,
      occurredAt: event?.occurredAt ?? null,
      summary: event
        ? `${event.method} ${event.url} on ${device?.hostname ?? 'a server'} (${event.userAgent})`
        : 'Event no longer available.',
      detail: event ? toStudentHttpRequestDto(event) : null,
    };
  }

  return { eventTable, eventId, occurredAt: null, summary: 'Unknown event type.', detail: null };
}
