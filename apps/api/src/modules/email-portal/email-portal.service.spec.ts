import { randomUUID } from 'crypto';
import { EmailPortalService } from './email-portal.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

const USER: AuthenticatedUser = {
  id: randomUUID(),
  role: 'student',
} as AuthenticatedUser;

const SESSION_ID = 'session-1';

function buildService(
  overrides: {
    email?: unknown;
    httpRequests?: unknown[];
    identities?: unknown[];
  } = {},
) {
  const prisma = {
    emailMessage: {
      findFirst: jest.fn(async () => overrides.email ?? null),
      findMany: jest.fn(async () => []),
    },
    httpRequest: {
      findMany: jest.fn(async () => overrides.httpRequests ?? []),
    },
    identity: {
      findMany: jest.fn(async () => overrides.identities ?? []),
    },
  };
  const sessionAccess = {
    getOwnedSession: jest.fn(async () => ({ id: SESSION_ID })),
  };
  const investigationActions = { record: jest.fn(async () => undefined) };

  const service = new EmailPortalService(
    prisma as never,
    sessionAccess as never,
    investigationActions as never,
  );
  return { service, prisma };
}

// §2.6: the "did anyone actually click it?" pivot — what turns a delivered suspicious email
// into a confirmed compromise. Derived purely from the session's own HTTP telemetry, never
// from any ground-truth flag on the email.
describe('EmailPortalService.getLinkActivity', () => {
  it('returns [] for an email with no URLs at all (e.g. a pure BEC pretext message)', async () => {
    const { service, prisma } = buildService({
      email: { id: 'email-1', sessionId: SESSION_ID, urls: [] },
    });

    await expect(
      service.getLinkActivity(SESSION_ID, 'email-1', USER),
    ).resolves.toEqual([]);
    // No URLs means there is nothing to correlate — don't scan HTTP telemetry at all.
    expect(prisma.httpRequest.findMany).not.toHaveBeenCalled();
  });

  it('reports zero clicks for a URL nobody visited', async () => {
    const { service } = buildService({
      email: {
        id: 'email-1',
        sessionId: SESSION_ID,
        urls: [
          {
            id: 'url-1',
            url: 'https://evil.example/login',
            reputation: 'malicious',
          },
        ],
      },
      httpRequests: [],
    });

    const result = await service.getLinkActivity(SESSION_ID, 'email-1', USER);
    expect(result).toEqual([
      {
        urlId: 'url-1',
        url: 'https://evil.example/login',
        reputation: 'malicious',
        clickCount: 0,
        clicks: [],
      },
    ]);
  });

  it('attributes each click to the identity and device that made it', async () => {
    const occurredAt = new Date('2026-08-01T10:00:00Z');
    const { service } = buildService({
      email: {
        id: 'email-1',
        sessionId: SESSION_ID,
        urls: [
          {
            id: 'url-1',
            url: 'https://evil.example/login',
            reputation: 'malicious',
          },
        ],
      },
      httpRequests: [
        {
          url: 'https://evil.example/login',
          occurredAt,
          statusCode: 200,
          sourceIp: '10.0.0.5',
          userAgent: 'Mozilla/5.0',
          identityId: 'identity-1',
          deviceId: 'device-1',
          device: { hostname: 'FIN-WKS-07' },
        },
      ],
      identities: [
        {
          id: 'identity-1',
          displayName: 'Jane Doe',
          userPrincipalName: 'jane.doe@contoso.com',
        },
      ],
    });

    const result = await service.getLinkActivity(SESSION_ID, 'email-1', USER);
    expect(result).toHaveLength(1);
    expect(result[0].clickCount).toBe(1);
    expect(result[0].clicks[0]).toMatchObject({
      occurredAt,
      identityDisplayName: 'Jane Doe',
      identityUserPrincipalName: 'jane.doe@contoso.com',
      deviceHostname: 'FIN-WKS-07',
      statusCode: 200,
    });
  });

  it('only counts requests matching each URL, keeping multi-link emails separate', async () => {
    const { service } = buildService({
      email: {
        id: 'email-1',
        sessionId: SESSION_ID,
        urls: [
          {
            id: 'url-1',
            url: 'https://evil.example/login',
            reputation: 'malicious',
          },
          {
            id: 'url-2',
            url: 'https://benign.example/unsubscribe',
            reputation: 'known_good',
          },
        ],
      },
      httpRequests: [
        {
          url: 'https://evil.example/login',
          occurredAt: new Date(),
          statusCode: 200,
          sourceIp: '10.0.0.5',
          userAgent: 'UA',
          identityId: null,
          deviceId: null,
          device: null,
        },
        {
          url: 'https://evil.example/login',
          occurredAt: new Date(),
          statusCode: 200,
          sourceIp: '10.0.0.6',
          userAgent: 'UA',
          identityId: null,
          deviceId: null,
          device: null,
        },
      ],
    });

    const result = await service.getLinkActivity(SESSION_ID, 'email-1', USER);
    expect(result.find((r) => r.urlId === 'url-1')!.clickCount).toBe(2);
    expect(result.find((r) => r.urlId === 'url-2')!.clickCount).toBe(0);
  });

  it('handles a click with no resolvable identity/device without dropping the row', async () => {
    const { service } = buildService({
      email: {
        id: 'email-1',
        sessionId: SESSION_ID,
        urls: [
          { id: 'url-1', url: 'https://evil.example/x', reputation: 'unknown' },
        ],
      },
      httpRequests: [
        {
          url: 'https://evil.example/x',
          occurredAt: new Date(),
          statusCode: 403,
          sourceIp: '10.0.0.9',
          userAgent: 'UA',
          identityId: null,
          deviceId: null,
          device: null,
        },
      ],
    });

    const result = await service.getLinkActivity(SESSION_ID, 'email-1', USER);
    expect(result[0].clickCount).toBe(1);
    expect(result[0].clicks[0]).toMatchObject({
      identityDisplayName: null,
      deviceHostname: null,
    });
  });
});
