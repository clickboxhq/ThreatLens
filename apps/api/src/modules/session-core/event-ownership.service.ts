import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app-exception';

/**
 * Confirms an (eventTable, eventId) pointer actually refers to an event inside the session
 * being worked.
 *
 * Evidence pinning and timeline building both accept a raw event id from the client and
 * previously validated it only as a well-formed UUID. Scoring then counted ground-truth hits
 * by `{ id: { in: ids }, isGroundTruthEvidence: true }` with no session filter, so an id from
 * somebody else's session — or from an earlier attempt at the same scenario — would have been
 * accepted and scored.
 *
 * The practical risk was low: event ids are v4 UUIDs and no endpoint exposes them across
 * sessions. But "unguessable" is not an access control, and every other resource in this
 * codebase is checked for ownership rather than trusted from the request body.
 */
@Injectable()
export class EventOwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  // Every telemetry table a student can legitimately pin or timeline. Also serves as an
  // allow-list: an unrecognised table name is rejected rather than silently trusted.
  private readonly finders: Record<
    string,
    (id: string) => Promise<{ sessionId: string } | null>
  > = {
    sign_in_events: (id) =>
      this.prisma.signInEvent.findUnique({
        where: { id },
        select: { sessionId: true },
      }),
    email_messages: (id) =>
      this.prisma.emailMessage.findUnique({
        where: { id },
        select: { sessionId: true },
      }),
    process_events: (id) =>
      this.prisma.processEvent.findUnique({
        where: { id },
        select: { sessionId: true },
      }),
    file_events: (id) =>
      this.prisma.fileEvent.findUnique({
        where: { id },
        select: { sessionId: true },
      }),
    network_events: (id) =>
      this.prisma.networkEvent.findUnique({
        where: { id },
        select: { sessionId: true },
      }),
    http_requests: (id) =>
      this.prisma.httpRequest.findUnique({
        where: { id },
        select: { sessionId: true },
      }),
    cloud_events: (id) =>
      this.prisma.cloudEvent.findUnique({
        where: { id },
        select: { sessionId: true },
      }),
    directory_audit_events: (id) =>
      this.prisma.directoryAuditEvent.findUnique({
        where: { id },
        select: { sessionId: true },
      }),
  };

  async assertEventInSession(
    sessionId: string,
    eventTable: string,
    eventId: string,
  ): Promise<void> {
    const find = this.finders[eventTable];
    if (!find) {
      throw new AppException(
        400,
        'UNKNOWN_EVENT_TABLE',
        'That is not a telemetry type you can reference.',
      );
    }

    const event = await find(eventId);

    // Deliberately the same error whether the event does not exist or belongs to another
    // session: distinguishing them would confirm the existence of an id the caller should
    // not know about.
    if (!event || event.sessionId !== sessionId) {
      throw new AppException(
        404,
        'EVENT_NOT_IN_SESSION',
        'That event is not part of this investigation.',
      );
    }
  }
}
