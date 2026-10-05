import { ExecutionContext } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AppException } from '../exceptions/app-exception';

// This guard is the one place every protected request's session actually gets checked —
// TTL, revocation, and account-active are all enforced here, server-side, on every request.
// It previously had no test coverage at all.

function buildGuard(opts: {
  verify?: (token: string) => unknown;
  currentUser?: { sessionVersion: number; status: string } | null;
}) {
  const jwtService = {
    verify: jest.fn(
      opts.verify ??
        (() => {
          throw new Error('not configured');
        }),
    ),
  };
  const prisma = {
    user: {
      findUnique: jest.fn(async () => opts.currentUser ?? null),
    },
  };
  const guard = new JwtAuthGuard(jwtService as never, prisma as never);
  return { guard, jwtService, prisma };
}

function contextWithHeader(header: string | undefined) {
  const request: {
    headers: Record<string, string>;
    header: (name: string) => string | undefined;
    user?: unknown;
  } = {
    headers: header ? { authorization: header } : {},
    header(name: string) {
      return this.headers[name.toLowerCase()];
    },
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    request,
  } as unknown as ExecutionContext & { request: typeof request };
}

// account-type shapes the guard must treat identically — it never branches on role, but the
// acceptance criteria calls for every account type to be verified explicitly, not assumed.
const ACCOUNT_TYPES = [
  { label: 'individual account', role: 'student', orgId: null },
  { label: 'organization student', role: 'student', orgId: randomUUID() },
  { label: 'organization admin', role: 'org_admin', orgId: randomUUID() },
  { label: 'platform admin', role: 'platform_admin', orgId: null },
];

describe('JwtAuthGuard', () => {
  it('rejects a request with no Authorization header', async () => {
    const { guard } = buildGuard({});
    const ctx = contextWithHeader(undefined);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  });

  it('rejects a header that is not a Bearer token', async () => {
    const { guard } = buildGuard({});
    const ctx = contextWithHeader('Basic dXNlcjpwYXNz');
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  });

  for (const account of ACCOUNT_TYPES) {
    // jwtService.verify is exactly what jsonwebtoken's real verify() does for an expired
    // token: it throws. This is the actual TTL enforcement path, not a frontend timer.
    it(`rejects an expired access token server-side for a ${account.label}`, async () => {
      const { guard } = buildGuard({
        verify: () => {
          throw new Error('jwt expired');
        },
      });
      const ctx = contextWithHeader('Bearer some.expired.token');
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: 401,
        code: 'UNAUTHENTICATED',
      });
      try {
        await guard.canActivate(ctx);
      } catch (e) {
        expect((e as AppException).message).toMatch(/expired/i);
      }
    });

    it(`rejects a token whose session_version is stale for a ${account.label} (revoked session)`, async () => {
      const userId = randomUUID();
      const { guard } = buildGuard({
        verify: () => ({
          sub: userId,
          role: account.role,
          org_id: account.orgId,
          session_version: 1,
        }),
        // DB says the session was bumped (logout-all / password reset / admin action) —
        // the token's claim (1) no longer matches current (2).
        currentUser: { sessionVersion: 2, status: 'active' },
      });
      const ctx = contextWithHeader('Bearer valid.but.stale.token');
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: 401,
        code: 'SESSION_REVOKED',
      });
    });

    it(`rejects a structurally-valid token whose account is no longer active for a ${account.label}`, async () => {
      const userId = randomUUID();
      const { guard } = buildGuard({
        verify: () => ({
          sub: userId,
          role: account.role,
          org_id: account.orgId,
          session_version: 1,
        }),
        currentUser: { sessionVersion: 1, status: 'suspended' },
      });
      const ctx = contextWithHeader('Bearer valid.token');
      await expect(guard.canActivate(ctx)).rejects.toMatchObject({
        status: 403,
        code: 'ACCOUNT_NOT_ACTIVE',
      });
    });

    it(`accepts a currently-valid token for a ${account.label} and attaches the caller to the request`, async () => {
      const userId = randomUUID();
      const { guard } = buildGuard({
        verify: () => ({
          sub: userId,
          role: account.role,
          org_id: account.orgId,
          session_version: 1,
        }),
        currentUser: { sessionVersion: 1, status: 'active' },
      });
      const ctx = contextWithHeader('Bearer valid.token');
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(ctx.request.user).toEqual({
        id: userId,
        role: account.role,
        orgId: account.orgId,
        sessionVersion: 1,
      });
    });
  }

  it('treats a deleted/unknown user id the same as a revoked session, not a crash', async () => {
    const { guard } = buildGuard({
      verify: () => ({
        sub: randomUUID(),
        role: 'student',
        org_id: null,
        session_version: 1,
      }),
      currentUser: null,
    });
    const ctx = contextWithHeader('Bearer valid.token');
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      status: 401,
      code: 'SESSION_REVOKED',
    });
  });
});
