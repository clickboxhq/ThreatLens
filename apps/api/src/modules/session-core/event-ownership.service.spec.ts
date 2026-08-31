import { EventOwnershipService } from './event-ownership.service';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Evidence pinning and timeline building take a raw event id from the request body. They
 * previously validated it only as a well-formed UUID, and scoring then counted ground-truth
 * hits with no session filter — so an id belonging to another session, or to an earlier
 * attempt at the same scenario, would have been accepted and scored.
 *
 * The practical risk was low (v4 UUIDs, never exposed cross-session). But unguessable is not
 * an access control, and every other resource here is checked for ownership rather than
 * trusted from the client.
 */
function buildService(found: { sessionId: string } | null) {
  const finder = jest.fn().mockResolvedValue(found);
  const prisma = {
    signInEvent: { findUnique: finder },
    emailMessage: { findUnique: finder },
    processEvent: { findUnique: finder },
    fileEvent: { findUnique: finder },
    networkEvent: { findUnique: finder },
    httpRequest: { findUnique: finder },
    cloudEvent: { findUnique: finder },
    directoryAuditEvent: { findUnique: finder },
  } as unknown as PrismaService;
  return { service: new EventOwnershipService(prisma), finder };
}

describe('EventOwnershipService', () => {
  it('accepts an event that belongs to the session being worked', async () => {
    const { service } = buildService({ sessionId: 'session-1' });
    await expect(
      service.assertEventInSession('session-1', 'sign_in_events', 'event-1'),
    ).resolves.toBeUndefined();
  });

  it('rejects an event belonging to a different session', async () => {
    const { service } = buildService({ sessionId: 'someone-elses-session' });
    await expect(
      service.assertEventInSession('session-1', 'sign_in_events', 'event-1'),
    ).rejects.toMatchObject({ code: 'EVENT_NOT_IN_SESSION' });
  });

  it('rejects an event that does not exist', async () => {
    const { service } = buildService(null);
    await expect(
      service.assertEventInSession('session-1', 'email_messages', 'nope'),
    ).rejects.toMatchObject({ code: 'EVENT_NOT_IN_SESSION' });
  });

  it('gives the same error for "wrong session" and "does not exist"', async () => {
    // Distinguishing them would confirm the existence of an id the caller should not know.
    const capture = async (found: { sessionId: string } | null) => {
      try {
        await buildService(found).service.assertEventInSession(
          's1',
          'sign_in_events',
          'e1',
        );
        return null;
      } catch (e) {
        return e as { code: string; status: number; message: string };
      }
    };

    const wrongSession = await capture({ sessionId: 'other' });
    const missing = await capture(null);

    expect(wrongSession!.code).toBe(missing!.code);
    expect(wrongSession!.status).toBe(missing!.status);
    expect(wrongSession!.message).toBe(missing!.message);
  });

  it('rejects an event table that is not on the allow-list', async () => {
    const { service, finder } = buildService({ sessionId: 'session-1' });
    await expect(
      service.assertEventInSession('session-1', 'users', 'event-1'),
    ).rejects.toMatchObject({ code: 'UNKNOWN_EVENT_TABLE' });
    // And it must not have gone looking before rejecting.
    expect(finder).not.toHaveBeenCalled();
  });

  it('covers every telemetry table a student can pin or timeline', async () => {
    const { service } = buildService({ sessionId: 'session-1' });
    for (const table of [
      'sign_in_events',
      'email_messages',
      'process_events',
      'file_events',
      'network_events',
      'http_requests',
      'cloud_events',
      'directory_audit_events',
    ]) {
      await expect(
        service.assertEventInSession('session-1', table, 'event-1'),
      ).resolves.toBeUndefined();
    }
  });
});
