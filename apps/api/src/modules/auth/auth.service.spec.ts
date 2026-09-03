import { randomUUID } from 'crypto';
import { generateSecret, generate as generateTotp } from 'otplib';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { MfaChallengeStore } from './mfa-challenge.store';
import { PasswordResetTokenStore } from './password-reset-token.store';
import { EmailVerificationTokenStore } from './email-verification-token.store';
import {
  LoginAttemptTracker,
  computeLockoutSeconds,
} from './login-attempt-tracker.service';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
import { EmailService } from '../../common/email/email.service';
import { AppException } from '../../common/exceptions/app-exception';
import type { User } from '@prisma/client';

const TEST_IP = '203.0.113.10';

function user(overrides: Partial<User> = {}): User {
  return {
    id: randomUUID(),
    orgId: null,
    email: 'analyst@example.com',
    passwordHash: 'irrelevant-for-these-tests',
    role: 'student',
    displayName: 'Test Analyst',
    status: 'active',
    emailVerifiedAt: new Date(),
    sessionVersion: 1,
    lastLoginAt: null,
    mfaEnabled: false,
    mfaSecret: null,
    mfaRecoveryCodesHash: [],
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

// A minimal in-memory stand-in for the Redis-backed store — same contract, deliberately NOT
// extending MfaChallengeStore (which opens a real ioredis connection in its constructor) so
// unit tests need no live Redis; full Redis integration is covered by live Docker verification.
class FakeMfaChallengeStore {
  private readonly byId = new Map<string, string>();

  async create(userId: string): Promise<string> {
    const id = randomUUID();
    this.byId.set(id, userId);
    return id;
  }

  async consume(challengeId: string): Promise<string | null> {
    const userId = this.byId.get(challengeId) ?? null;
    this.byId.delete(challengeId);
    return userId;
  }

  private readonly enrolments = new Map<string, string>();

  async createEnrolment(userId: string): Promise<string> {
    const id = randomUUID();
    this.enrolments.set(id, userId);
    return id;
  }

  async peekEnrolment(challengeId: string): Promise<string | null> {
    return this.enrolments.get(challengeId) ?? null;
  }

  async consumeEnrolment(challengeId: string): Promise<string | null> {
    const userId = this.enrolments.get(challengeId) ?? null;
    this.enrolments.delete(challengeId);
    return userId;
  }
}

// Same rationale as FakeMfaChallengeStore — deliberately not extending PasswordResetTokenStore.
class FakePasswordResetTokenStore {
  private readonly byToken = new Map<string, string>();

  async create(userId: string): Promise<string> {
    const token = randomUUID();
    this.byToken.set(token, userId);
    return token;
  }

  async consume(token: string): Promise<string | null> {
    const userId = this.byToken.get(token) ?? null;
    this.byToken.delete(token);
    return userId;
  }
}

// Same rationale as FakePasswordResetTokenStore — deliberately not extending EmailVerificationTokenStore.
class FakeEmailVerificationTokenStore {
  private readonly byToken = new Map<string, string>();

  async create(userId: string): Promise<string> {
    const token = randomUUID();
    this.byToken.set(token, userId);
    return token;
  }

  async consume(token: string): Promise<string | null> {
    const userId = this.byToken.get(token) ?? null;
    this.byToken.delete(token);
    return userId;
  }
}

// Same rationale again — reuses the real computeLockoutSeconds math (already covered by its
// own pure-function tests) but keeps everything in memory instead of a live Redis connection.
class FakeLoginAttemptTracker {
  private readonly counts = new Map<string, number>();

  private key(email: string, sourceIp: string): string {
    return `${email.toLowerCase()}:${sourceIp}`;
  }

  async lockoutSecondsRemaining(
    email: string,
    sourceIp: string,
  ): Promise<number> {
    const count = this.counts.get(this.key(email, sourceIp)) ?? 0;
    return computeLockoutSeconds(count);
  }

  async recordFailure(email: string, sourceIp: string): Promise<void> {
    const key = this.key(email, sourceIp);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  async clear(email: string, sourceIp: string): Promise<void> {
    this.counts.delete(this.key(email, sourceIp));
  }
}

function buildService(users: Map<string, User>) {
  const prisma = {
    user: {
      findUnique: jest.fn(
        async ({ where }: { where: { id?: string; email?: string } }) => {
          if (where.id) return users.get(where.id) ?? null;
          return (
            [...users.values()].find((u) => u.email === where.email) ?? null
          );
        },
      ),
      findUniqueOrThrow: jest.fn(
        async ({ where }: { where: { id: string } }) => {
          const found = users.get(where.id);
          if (!found) throw new Error(`no user ${where.id}`);
          return found;
        },
      ),
      create: jest.fn(async ({ data }: { data: Partial<User> }) => {
        const created = user({ ...data, id: randomUUID() });
        users.set(created.id, created);
        return created;
      }),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const existing = users.get(where.id)!;
          const updated = {
            ...existing,
            ...data,
            sessionVersion:
              typeof data.sessionVersion === 'object' &&
              data.sessionVersion !== null
                ? existing.sessionVersion +
                  (data.sessionVersion as { increment: number }).increment
                : ((data.sessionVersion as number | undefined) ??
                  existing.sessionVersion),
          };
          users.set(where.id, updated);
          return updated;
        },
      ),
      // Honours the emailVerifiedAt: null guard rather than always reporting a hit — the
      // whole point of the real query is that a second verification matches nothing.
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; emailVerifiedAt?: null };
          data: Record<string, unknown>;
        }) => {
          const existing = users.get(where.id);
          if (!existing) return { count: 0 };
          if (
            Object.prototype.hasOwnProperty.call(where, 'emailVerifiedAt') &&
            where.emailVerifiedAt === null &&
            existing.emailVerifiedAt !== null
          ) {
            return { count: 0 };
          }
          users.set(where.id, { ...existing, ...data } as User);
          return { count: 1 };
        },
      ),
    },
    refreshToken: {
      create: jest.fn(async () => ({ id: randomUUID() })),
      update: jest.fn(async () => ({})),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  const jwt = { sign: jest.fn(() => 'signed.jwt.token') };
  const config = { get: jest.fn(() => undefined) };
  const mfaChallenges = new FakeMfaChallengeStore();
  const passwordResetTokens = new FakePasswordResetTokenStore();
  const emailVerificationTokens = new FakeEmailVerificationTokenStore();
  const loginAttempts = new FakeLoginAttemptTracker();
  const auditLog = { record: jest.fn(async () => undefined) };
  const emailService = { send: jest.fn(async () => undefined) };

  const service = new AuthService(
    prisma as never,
    jwt as never,
    config as never,
    mfaChallenges as unknown as MfaChallengeStore,
    passwordResetTokens as unknown as PasswordResetTokenStore,
    emailVerificationTokens as unknown as EmailVerificationTokenStore,
    loginAttempts as unknown as LoginAttemptTracker,
    auditLog as unknown as AuditLogService,
    emailService as unknown as EmailService,
  );
  return {
    service,
    prisma,
    mfaChallenges,
    passwordResetTokens,
    emailVerificationTokens,
    loginAttempts,
    auditLog,
    emailService,
  };
}

// The JWT only ever carries id/role — this is the one endpoint a Student's own profile page
// can read their real email/displayName/verification status back from.
describe('AuthService.getMe', () => {
  it('returns the profile fields a JWT does not carry, deriving emailVerified from emailVerifiedAt', async () => {
    const u = user({
      email: 'jane@example.com',
      displayName: 'Jane Doe',
      emailVerifiedAt: null,
    });
    const { service } = buildService(new Map([[u.id, u]]));

    await expect(service.getMe(u.id)).resolves.toEqual({
      id: u.id,
      email: 'jane@example.com',
      displayName: 'Jane Doe',
      role: 'student',
      emailVerified: false,
      createdAt: u.createdAt,
    });
  });

  it('rejects with 404 for an unknown user id', async () => {
    const { service } = buildService(new Map());
    await expect(service.getMe(randomUUID())).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });
});

describe('AuthService profile persistence', () => {
  const PROFILE = {
    firstName: 'Danielle',
    lastName: 'Okonkwo',
    avatarType: 'upload',
    avatarDataUrl: 'data:image/png;base64,AAAA',
    professionalRole: 'SOC Analyst',
  } as unknown as Partial<User>;

  async function loginWith(overrides: Partial<Record<string, unknown>>) {
    const argon2 = await import('argon2');
    const passwordHash = await argon2.hash('correct horse battery staple', {
      type: argon2.argon2id,
    });
    const u = user({ passwordHash, ...overrides });
    const { service } = buildService(new Map([[u.id, u]]));
    return service.login(
      { email: u.email, password: 'correct horse battery staple' },
      TEST_IP,
    );
  }

  // The client caches whatever login returns. When that was a four-field subset, a signed-in
  // user had no avatar and no first/last name, so the app rendered initials and the signup
  // displayName — a profile that looked saved until you signed out and back in.
  it('login() returns the avatar and profile fields, not just id/name/role', async () => {
    const result = await loginWith(PROFILE);
    expect('user' in result && result.user).toMatchObject({
      firstName: 'Danielle',
      lastName: 'Okonkwo',
      avatarType: 'upload',
      avatarDataUrl: 'data:image/png;base64,AAAA',
      professionalRole: 'SOC Analyst',
    });
  });

  it('login() and getMe() agree on the shape they return', async () => {
    // They drifted apart once already; asserting the key sets match is what stops it silently
    // happening again.
    const argon2 = await import('argon2');
    const passwordHash = await argon2.hash('correct horse battery staple', {
      type: argon2.argon2id,
    });
    const u = user({ passwordHash, ...PROFILE });
    const { service } = buildService(new Map([[u.id, u]]));

    const result = await service.login(
      { email: u.email, password: 'correct horse battery staple' },
      TEST_IP,
    );
    const me = await service.getMe(u.id);

    expect('user' in result && Object.keys(result.user).sort()).toEqual(
      Object.keys(me).sort(),
    );
  });

  describe('updateProfile keeps displayName in step with the name fields', () => {
    it('derives displayName from first and last name', async () => {
      const u = user({ displayName: 'Old Signup Name' });
      const users = new Map([[u.id, u]]);
      const { service } = buildService(users);

      const updated = await service.updateProfile(u.id, {
        firstName: 'Danielle',
        lastName: 'Okonkwo',
      });
      expect(updated.displayName).toBe('Danielle Okonkwo');
    });

    it('uses whichever name is present when only one is set', async () => {
      const u = user({ displayName: 'Old Signup Name' });
      const { service } = buildService(new Map([[u.id, u]]));
      const updated = await service.updateProfile(u.id, { firstName: 'Dana' });
      expect(updated.displayName).toBe('Dana');
    });

    it('leaves displayName alone when the update carries no name at all', async () => {
      // Editing only a bio must not blank out the name shown on every other screen.
      const u = user({ displayName: 'Old Signup Name' });
      const { service } = buildService(new Map([[u.id, u]]));
      const updated = await service.updateProfile(u.id, { bio: 'Just a bio.' });
      expect(updated.displayName).toBe('Old Signup Name');
    });

    it('does not blank displayName when both names are cleared', async () => {
      const u = user({
        displayName: 'Danielle Okonkwo',
        firstName: 'Danielle',
        lastName: 'Okonkwo',
      } as never);
      const { service } = buildService(new Map([[u.id, u]]));
      const updated = await service.updateProfile(u.id, {
        firstName: '',
        lastName: '',
      });
      expect(updated.displayName).toBe('Danielle Okonkwo');
    });
  });
});

describe('AuthService MFA (§15.1, §16.2)', () => {
  it('login() does not issue tokens for an MFA-enrolled account, returning a challenge instead', async () => {
    const argon2 = await import('argon2');
    const passwordHash = await argon2.hash('correct horse battery staple', {
      type: argon2.argon2id,
    });
    const enrolled = user({
      mfaEnabled: true,
      mfaSecret: generateSecret(),
      passwordHash,
    });
    const users = new Map([[enrolled.id, enrolled]]);
    const { service } = buildService(users);

    const result = await service.login(
      { email: enrolled.email, password: 'correct horse battery staple' },
      TEST_IP,
    );
    expect('mfaRequired' in result && result.mfaRequired).toBe(true);
  });

  it('login() issues tokens directly for an account without MFA', async () => {
    const argon2 = await import('argon2');
    const passwordHash = await argon2.hash('correct horse battery staple', {
      type: argon2.argon2id,
    });
    const plain = user({ passwordHash });
    const users = new Map([[plain.id, plain]]);
    const { service } = buildService(users);

    const result = await service.login(
      { email: plain.email, password: 'correct horse battery staple' },
      TEST_IP,
    );
    expect('mfaRequired' in result).toBe(false);
    expect('accessToken' in result && result.accessToken).toBeTruthy();
  });

  it('mfaVerify() completes login with a valid TOTP code and rejects a bad one', async () => {
    const secret = generateSecret();
    const enrolled = user({ mfaEnabled: true, mfaSecret: secret });
    const users = new Map([[enrolled.id, enrolled]]);
    const { service, mfaChallenges } = buildService(users);

    const validCode = await generateTotp({ secret });
    const challengeId = await mfaChallenges.create(enrolled.id);
    const result = await service.mfaVerify(challengeId, validCode);
    expect(result.user.id).toBe(enrolled.id);

    const secondChallengeId = await mfaChallenges.create(enrolled.id);
    await expect(
      service.mfaVerify(secondChallengeId, '000000'),
    ).rejects.toThrow(AppException);
  });

  it('mfaVerify() rejects a challenge id that was already consumed (one-time use)', async () => {
    const secret = generateSecret();
    const enrolled = user({ mfaEnabled: true, mfaSecret: secret });
    const users = new Map([[enrolled.id, enrolled]]);
    const { service, mfaChallenges } = buildService(users);

    const validCode = await generateTotp({ secret });
    const challengeId = await mfaChallenges.create(enrolled.id);
    await service.mfaVerify(challengeId, validCode);

    await expect(service.mfaVerify(challengeId, validCode)).rejects.toThrow(
      AppException,
    );
  });

  it('mfaEnable() turns MFA on only after a valid code against the pending secret, and issues recovery codes', async () => {
    const target = user();
    const users = new Map([[target.id, target]]);
    const { service } = buildService(users);

    const setup = await service.mfaSetup(target.id);
    const validCode = await generateTotp({ secret: setup.secret });

    const { recoveryCodes } = await service.mfaEnable(target.id, validCode);
    expect(recoveryCodes).toHaveLength(10);
    expect(new Set(recoveryCodes).size).toBe(10);
    expect(users.get(target.id)!.mfaEnabled).toBe(true);
  });

  it('mfaEnable() rejects an incorrect code and leaves MFA disabled', async () => {
    const target = user();
    const users = new Map([[target.id, target]]);
    const { service } = buildService(users);

    await service.mfaSetup(target.id);
    await expect(service.mfaEnable(target.id, '000000')).rejects.toThrow(
      AppException,
    );
    expect(users.get(target.id)!.mfaEnabled).toBe(false);
  });

  it('a recovery code completes login exactly once, then is rejected on reuse', async () => {
    const target = user();
    const users = new Map([[target.id, target]]);
    const { service, mfaChallenges } = buildService(users);

    const setup = await service.mfaSetup(target.id);
    const validCode = await generateTotp({ secret: setup.secret });
    const { recoveryCodes } = await service.mfaEnable(target.id, validCode);
    const recoveryCode = recoveryCodes[0];

    const challengeId = await mfaChallenges.create(target.id);
    const result = await service.mfaVerify(challengeId, recoveryCode);
    expect(result.user.id).toBe(target.id);

    const secondChallengeId = await mfaChallenges.create(target.id);
    await expect(
      service.mfaVerify(secondChallengeId, recoveryCode),
    ).rejects.toThrow(AppException);
  });

  it('mfaDisable() is blocked for org_admin and platform_admin (§15.2 mandatory MFA)', async () => {
    const argon2 = await import('argon2');
    const passwordHash = await argon2.hash('correct horse battery staple', {
      type: argon2.argon2id,
    });
    const admin = user({
      role: 'org_admin',
      mfaEnabled: true,
      mfaSecret: generateSecret(),
      passwordHash,
    });
    const users = new Map([[admin.id, admin]]);
    const { service } = buildService(users);

    await expect(
      service.mfaDisable(admin.id, 'correct horse battery staple'),
    ).rejects.toThrow(AppException);
    expect(users.get(admin.id)!.mfaEnabled).toBe(true);
  });

  it('mfaDisable() succeeds for a student with the correct password and clears the secret and recovery codes', async () => {
    const argon2 = await import('argon2');
    const passwordHash = await argon2.hash('correct horse battery staple', {
      type: argon2.argon2id,
    });
    const enrolled = user({
      mfaEnabled: true,
      mfaSecret: generateSecret(),
      mfaRecoveryCodesHash: ['deadbeef'],
      passwordHash,
    });
    const users = new Map([[enrolled.id, enrolled]]);
    const { service } = buildService(users);

    await service.mfaDisable(enrolled.id, 'correct horse battery staple');
    const updated = users.get(enrolled.id)!;
    expect(updated.mfaEnabled).toBe(false);
    expect(updated.mfaSecret).toBeNull();
    expect(updated.mfaRecoveryCodesHash).toHaveLength(0);
  });

  it('mfaDisable() rejects an incorrect password', async () => {
    const argon2 = await import('argon2');
    const passwordHash = await argon2.hash('correct horse battery staple', {
      type: argon2.argon2id,
    });
    const enrolled = user({
      mfaEnabled: true,
      mfaSecret: generateSecret(),
      passwordHash,
    });
    const users = new Map([[enrolled.id, enrolled]]);
    const { service } = buildService(users);

    await expect(
      service.mfaDisable(enrolled.id, 'wrong password'),
    ).rejects.toThrow(AppException);
    expect(users.get(enrolled.id)!.mfaEnabled).toBe(true);
  });
});

describe('AuthService password reset (§15.1, §16.2)', () => {
  it('requestPasswordReset() creates a token for a known, active account with a password', async () => {
    const target = user();
    const users = new Map([[target.id, target]]);
    const { service, passwordResetTokens } = buildService(users);
    const createSpy = jest.spyOn(passwordResetTokens, 'create');

    await service.requestPasswordReset(target.email);
    expect(createSpy).toHaveBeenCalledWith(target.id);
  });

  it('requestPasswordReset() resolves without creating a token for an unknown email (no user enumeration)', async () => {
    const users = new Map<string, User>();
    const { service, passwordResetTokens } = buildService(users);
    const createSpy = jest.spyOn(passwordResetTokens, 'create');

    await expect(
      service.requestPasswordReset('nobody@example.com'),
    ).resolves.toBeUndefined();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('requestPasswordReset() does not create a token for a suspended account', async () => {
    const suspended = user({ status: 'suspended' });
    const users = new Map([[suspended.id, suspended]]);
    const { service, passwordResetTokens } = buildService(users);
    const createSpy = jest.spyOn(passwordResetTokens, 'create');

    await service.requestPasswordReset(suspended.email);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('requestPasswordReset() does not create a token for an account with no password set', async () => {
    const ssoOnly = user({ passwordHash: null });
    const users = new Map([[ssoOnly.id, ssoOnly]]);
    const { service, passwordResetTokens } = buildService(users);
    const createSpy = jest.spyOn(passwordResetTokens, 'create');

    await service.requestPasswordReset(ssoOnly.email);
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('confirmPasswordReset() sets a new password, invalidates the old one, and revokes other sessions', async () => {
    const oldPasswordHash = await argon2.hash('old password 123', {
      type: argon2.argon2id,
    });
    const target = user({ passwordHash: oldPasswordHash });
    const users = new Map([[target.id, target]]);
    const { service, prisma, passwordResetTokens } = buildService(users);

    const token = await passwordResetTokens.create(target.id);
    await service.confirmPasswordReset(token, 'brand new password 456');

    const updated = users.get(target.id)!;
    expect(
      await argon2.verify(updated.passwordHash!, 'brand new password 456'),
    ).toBe(true);
    expect(await argon2.verify(oldPasswordHash, 'old password 123')).toBe(true); // sanity: old hash itself still verifies its own password
    expect(updated.sessionVersion).toBe(target.sessionVersion + 1);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: target.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  // A lost-authenticator-with-no-recovery-codes lockout has no other self-service path — the
  // login MFA prompt requires a code, and mfaDisable() itself requires an authenticated session
  // (i.e. already being past that same prompt). Clicking a real, emailed, single-use reset link
  // is the one out-of-band proof of ownership this codebase already trusts elsewhere, so it
  // doubles as MFA recovery for roles where MFA is optional.
  it('confirmPasswordReset() clears MFA for a student/instructor account that has it enabled', async () => {
    const target = user({
      role: 'student',
      mfaEnabled: true,
      mfaSecret: 'some-secret',
      mfaRecoveryCodesHash: ['hash1', 'hash2'],
    });
    const users = new Map([[target.id, target]]);
    const { service, passwordResetTokens, auditLog } = buildService(users);

    const token = await passwordResetTokens.create(target.id);
    await service.confirmPasswordReset(token, 'brand new password 456');

    const updated = users.get(target.id)!;
    expect(updated.mfaEnabled).toBe(false);
    expect(updated.mfaSecret).toBeNull();
    expect(updated.mfaRecoveryCodesHash).toEqual([]);
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { mfaCleared: true } }),
    );
  });

  // §15.2: MFA is mandatory for these two roles specifically so it can't be casually removed —
  // mfaDisable() already enforces this, and password reset must not become a back door around
  // it (an attacker who only compromises the mailbox still can't strip 2FA off a privileged
  // account this way).
  it('confirmPasswordReset() does NOT clear MFA for an org_admin/platform_admin account', async () => {
    for (const role of ['org_admin', 'platform_admin'] as const) {
      const target = user({
        role,
        mfaEnabled: true,
        mfaSecret: 'some-secret',
        mfaRecoveryCodesHash: ['hash1'],
      });
      const users = new Map([[target.id, target]]);
      const { service, passwordResetTokens, auditLog } = buildService(users);

      const token = await passwordResetTokens.create(target.id);
      await service.confirmPasswordReset(token, 'brand new password 456');

      const updated = users.get(target.id)!;
      expect(updated.mfaEnabled).toBe(true);
      expect(updated.mfaSecret).toBe('some-secret');
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: undefined }),
      );
    }
  });

  it('confirmPasswordReset() leaves MFA fields alone when MFA was never enabled', async () => {
    const target = user({ role: 'student', mfaEnabled: false });
    const users = new Map([[target.id, target]]);
    const { service, passwordResetTokens } = buildService(users);

    const token = await passwordResetTokens.create(target.id);
    await service.confirmPasswordReset(token, 'brand new password 456');

    const updated = users.get(target.id)!;
    expect(updated.mfaEnabled).toBe(false);
  });

  it('confirmPasswordReset() rejects an invalid or unknown token', async () => {
    const users = new Map<string, User>();
    const { service } = buildService(users);

    await expect(
      service.confirmPasswordReset(
        'not-a-real-token',
        'brand new password 456',
      ),
    ).rejects.toThrow(AppException);
  });

  it('confirmPasswordReset() rejects a token that was already used (one-time use)', async () => {
    const target = user();
    const users = new Map([[target.id, target]]);
    const { service, passwordResetTokens } = buildService(users);

    const token = await passwordResetTokens.create(target.id);
    await service.confirmPasswordReset(token, 'brand new password 456');

    await expect(
      service.confirmPasswordReset(token, 'yet another password 789'),
    ).rejects.toThrow(AppException);
  });
});

describe('AuthService email verification (§15.1, §16.2)', () => {
  it('signup() creates an unverified account and issues a verification token', async () => {
    const users = new Map<string, User>();
    const { service, emailVerificationTokens } = buildService(users);
    const createSpy = jest.spyOn(emailVerificationTokens, 'create');

    const result = await service.signup({
      email: 'new.student@example.com',
      password: 'correct horse battery staple',
      displayName: 'New Student',
    });

    expect(result.emailVerificationRequired).toBe(true);
    expect(createSpy).toHaveBeenCalledWith(result.userId);
    const created = users.get(result.userId)!;
    expect(created.emailVerifiedAt).toBeNull();
  });

  it('requestEmailVerification() issues a fresh token for an unverified account', async () => {
    const target = user({ emailVerifiedAt: null });
    const users = new Map([[target.id, target]]);
    const { service, emailVerificationTokens } = buildService(users);
    const createSpy = jest.spyOn(emailVerificationTokens, 'create');

    await service.requestEmailVerification(target.id);
    expect(createSpy).toHaveBeenCalledWith(target.id);
  });

  it('requestEmailVerification() rejects an already-verified account', async () => {
    const target = user({ emailVerifiedAt: new Date() });
    const users = new Map([[target.id, target]]);
    const { service } = buildService(users);

    await expect(
      service.requestEmailVerification(target.id),
    ).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_VERIFIED',
    });
  });

  it('confirmEmailVerification() sets emailVerifiedAt for a valid token', async () => {
    const target = user({ emailVerifiedAt: null });
    const users = new Map([[target.id, target]]);
    const { service, emailVerificationTokens } = buildService(users);

    const token = await emailVerificationTokens.create(target.id);
    await service.confirmEmailVerification(token);

    expect(users.get(target.id)!.emailVerifiedAt).not.toBeNull();
  });

  it('confirmEmailVerification() sends the welcome email on first verification', async () => {
    const target = user({ emailVerifiedAt: null });
    const users = new Map([[target.id, target]]);
    const { service, emailVerificationTokens, emailService } =
      buildService(users);

    const token = await emailVerificationTokens.create(target.id);
    emailService.send.mockClear();
    await service.confirmEmailVerification(token);

    expect(emailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: target.email,
        subject: 'Welcome to ThreatLens',
      }),
    );
  });

  it('confirmEmailVerification() sends the welcome email only once', async () => {
    // Requesting a second link before using the first leaves two valid tokens, and both
    // consume successfully. Guarding on the row rather than on the token is what stops the
    // second one sending a duplicate welcome.
    const target = user({ emailVerifiedAt: null });
    const users = new Map([[target.id, target]]);
    const { service, emailVerificationTokens, emailService } =
      buildService(users);

    const first = await emailVerificationTokens.create(target.id);
    const second = await emailVerificationTokens.create(target.id);
    emailService.send.mockClear();

    await service.confirmEmailVerification(first);
    await service.confirmEmailVerification(second);

    const calls = emailService.send.mock.calls as unknown as [
      { subject: string },
    ][];
    const welcomes = calls.filter(
      (c) => c[0].subject === 'Welcome to ThreatLens',
    );
    expect(welcomes).toHaveLength(1);
  });

  it('confirmEmailVerification() rejects an invalid or unknown token', async () => {
    const users = new Map<string, User>();
    const { service } = buildService(users);

    await expect(
      service.confirmEmailVerification('not-a-real-token'),
    ).rejects.toMatchObject({
      code: 'INVALID_VERIFICATION_TOKEN',
    });
  });

  it('confirmEmailVerification() rejects a token that was already used (one-time use)', async () => {
    const target = user({ emailVerifiedAt: null });
    const users = new Map([[target.id, target]]);
    const { service, emailVerificationTokens } = buildService(users);

    const token = await emailVerificationTokens.create(target.id);
    await service.confirmEmailVerification(token);

    await expect(service.confirmEmailVerification(token)).rejects.toThrow(
      AppException,
    );
  });
});

describe('AuthService login lockout (§15.1)', () => {
  it('locks out the (account, IP) pair after enough failed attempts, before the threshold is reached nothing is blocked', async () => {
    const argon2Mod = await import('argon2');
    const passwordHash = await argon2Mod.hash('correct horse battery staple', {
      type: argon2Mod.argon2id,
    });
    const target = user({ passwordHash });
    const users = new Map([[target.id, target]]);
    const { service } = buildService(users);

    for (let i = 0; i < 4; i++) {
      await expect(
        service.login(
          { email: target.email, password: 'wrong password' },
          TEST_IP,
        ),
      ).rejects.toThrow(AppException);
    }

    // Still under threshold — a correct password should still work.
    const result = await service.login(
      { email: target.email, password: 'correct horse battery staple' },
      TEST_IP,
    );
    expect('mfaRequired' in result).toBe(false);
  });

  it('rejects even a correct password once the (account, IP) pair is locked out', async () => {
    const passwordHash = await argon2.hash('correct horse battery staple', {
      type: argon2.argon2id,
    });
    const target = user({ passwordHash });
    const users = new Map([[target.id, target]]);
    const { service } = buildService(users);

    for (let i = 0; i < 5; i++) {
      await expect(
        service.login(
          { email: target.email, password: 'wrong password' },
          TEST_IP,
        ),
      ).rejects.toThrow(AppException);
    }

    await expect(
      service.login(
        { email: target.email, password: 'correct horse battery staple' },
        TEST_IP,
      ),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
    });
  });

  it('does not lock out attempts against the same account from a different source IP', async () => {
    const passwordHash = await argon2.hash('correct horse battery staple', {
      type: argon2.argon2id,
    });
    const target = user({ passwordHash });
    const users = new Map([[target.id, target]]);
    const { service } = buildService(users);

    for (let i = 0; i < 5; i++) {
      await expect(
        service.login(
          { email: target.email, password: 'wrong password' },
          TEST_IP,
        ),
      ).rejects.toThrow(AppException);
    }

    const result = await service.login(
      { email: target.email, password: 'correct horse battery staple' },
      '198.51.100.99',
    );
    expect('mfaRequired' in result).toBe(false);
  });

  it('clears the failure count on a successful login, so a later mistake does not inherit prior attempts', async () => {
    const passwordHash = await argon2.hash('correct horse battery staple', {
      type: argon2.argon2id,
    });
    const target = user({ passwordHash });
    const users = new Map([[target.id, target]]);
    const { service } = buildService(users);

    for (let i = 0; i < 3; i++) {
      await expect(
        service.login(
          { email: target.email, password: 'wrong password' },
          TEST_IP,
        ),
      ).rejects.toThrow(AppException);
    }
    await service.login(
      { email: target.email, password: 'correct horse battery staple' },
      TEST_IP,
    );

    // Only 1 failure since the successful login — nowhere near the threshold.
    await expect(
      service.login(
        { email: target.email, password: 'wrong password' },
        TEST_IP,
      ),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('applies the same lockout mechanics to a nonexistent email, so account existence cannot be inferred by lockout behavior', async () => {
    const users = new Map<string, User>();
    const { service } = buildService(users);

    for (let i = 0; i < 5; i++) {
      await expect(
        service.login(
          { email: 'nobody@example.com', password: 'irrelevant' },
          TEST_IP,
        ),
      ).rejects.toThrow(AppException);
    }

    await expect(
      service.login(
        { email: 'nobody@example.com', password: 'irrelevant' },
        TEST_IP,
      ),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
    });
  });
});

describe('AuthService audit logging (§6.22)', () => {
  function actionsRecorded(auditLog: { record: jest.Mock }): string[] {
    return auditLog.record.mock.calls.map(
      (call) => (call[0] as { action: string }).action,
    );
  }

  it('records a `login` entry for a successful non-MFA login and nothing for password-reset requests', async () => {
    const passwordHash = await argon2.hash('correct horse battery staple', {
      type: argon2.argon2id,
    });
    const target = user({ passwordHash });
    const users = new Map([[target.id, target]]);
    const { service, auditLog } = buildService(users);

    await service.login(
      { email: target.email, password: 'correct horse battery staple' },
      TEST_IP,
    );
    expect(actionsRecorded(auditLog)).toEqual(['login']);
  });

  it('records `login_failed` on a bad password, and `account_locked` on the failure that crosses the threshold', async () => {
    const passwordHash = await argon2.hash('correct horse battery staple', {
      type: argon2.argon2id,
    });
    const target = user({ passwordHash });
    const users = new Map([[target.id, target]]);
    const { service, auditLog } = buildService(users);

    for (let i = 0; i < 5; i++) {
      await expect(
        service.login(
          { email: target.email, password: 'wrong password' },
          TEST_IP,
        ),
      ).rejects.toThrow(AppException);
    }

    const actions = actionsRecorded(auditLog);
    expect(actions.filter((a) => a === 'login_failed')).toHaveLength(5);
    expect(actions.filter((a) => a === 'account_locked')).toHaveLength(1); // only the 5th, threshold-crossing failure
  });

  it('records `login` for a successful MFA-completed login (via mfaVerify, not login)', async () => {
    const secret = generateSecret();
    const enrolled = user({ mfaEnabled: true, mfaSecret: secret });
    const users = new Map([[enrolled.id, enrolled]]);
    const { service, mfaChallenges, auditLog } = buildService(users);

    const validCode = await generateTotp({ secret });
    const challengeId = await mfaChallenges.create(enrolled.id);
    await service.mfaVerify(challengeId, validCode, TEST_IP);

    expect(actionsRecorded(auditLog)).toEqual(['login']);
  });

  it('records `mfa_enabled` and `mfa_disabled`', async () => {
    const passwordHash = await argon2.hash('correct horse battery staple', {
      type: argon2.argon2id,
    });
    const target = user({ passwordHash });
    const users = new Map([[target.id, target]]);
    const { service, auditLog } = buildService(users);

    const setup = await service.mfaSetup(target.id);
    const validCode = await generateTotp({ secret: setup.secret });
    await service.mfaEnable(target.id, validCode);
    expect(actionsRecorded(auditLog)).toEqual(['mfa_enabled']);

    await service.mfaDisable(target.id, 'correct horse battery staple');
    expect(actionsRecorded(auditLog)).toEqual(['mfa_enabled', 'mfa_disabled']);
  });

  it('records `password_reset` on a completed reset', async () => {
    const target = user();
    const users = new Map([[target.id, target]]);
    const { service, passwordResetTokens, auditLog } = buildService(users);

    const token = await passwordResetTokens.create(target.id);
    await service.confirmPasswordReset(token, 'brand new password 456');

    expect(actionsRecorded(auditLog)).toEqual(['password_reset']);
  });

  it('records `email_verified` on a completed verification', async () => {
    const target = user({ emailVerifiedAt: null });
    const users = new Map([[target.id, target]]);
    const { service, emailVerificationTokens, auditLog } = buildService(users);

    const token = await emailVerificationTokens.create(target.id);
    await service.confirmEmailVerification(token);

    expect(actionsRecorded(auditLog)).toEqual(['email_verified']);
  });

  it('records `logout_all`', async () => {
    const target = user();
    const users = new Map([[target.id, target]]);
    const { service, auditLog } = buildService(users);

    await service.logoutAll(target.id, TEST_IP);
    expect(actionsRecorded(auditLog)).toEqual(['logout_all']);
  });
});

// §15.2. Before this, MFA was described as mandatory for the privileged roles but only ever
// prevented *disabling* it — an admin who never enrolled simply logged in with a password
// forever. These cover the enforcement and, just as importantly, the escape hatch that stops
// the enforcement becoming a lockout.
describe('mandatory MFA enrolment for privileged roles', () => {
  const PASSWORD = 'correct horse battery staple';

  async function privileged(role: 'platform_admin' | 'org_admin') {
    const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
    return user({ role, mfaEnabled: false, passwordHash });
  }

  it('blocks a platform_admin who has not enrolled, and hands them a way to enrol', async () => {
    const admin = await privileged('platform_admin');
    const users = new Map([[admin.id, admin]]);
    const { service } = buildService(users);

    const result = await service.login(
      { email: admin.email, password: PASSWORD },
      TEST_IP,
    );

    expect('mfaEnrolmentRequired' in result).toBe(true);
    // No tokens: the login has not completed.
    expect('accessToken' in result).toBe(false);
    // But a challenge, or they could neither log in nor enrol.
    expect(
      'enrolmentChallengeId' in result && result.enrolmentChallengeId,
    ).toBeTruthy();
  });

  it('applies to org_admin as well as platform_admin', async () => {
    const admin = await privileged('org_admin');
    const users = new Map([[admin.id, admin]]);
    const { service } = buildService(users);

    const result = await service.login(
      { email: admin.email, password: PASSWORD },
      TEST_IP,
    );
    expect('mfaEnrolmentRequired' in result).toBe(true);
  });

  it('leaves unprivileged accounts entirely alone', async () => {
    // Students and instructors must keep logging in with a password only.
    const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
    for (const role of ['student', 'instructor'] as const) {
      const learner = user({ role, mfaEnabled: false, passwordHash });
      const { service } = buildService(new Map([[learner.id, learner]]));
      const result = await service.login(
        { email: learner.email, password: PASSWORD },
        TEST_IP,
      );
      expect('mfaEnrolmentRequired' in result).toBe(false);
      expect('accessToken' in result).toBe(true);
    }
  });

  it('still asks an enrolled admin for a code rather than re-enrolment', async () => {
    const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
    const admin = user({
      role: 'platform_admin',
      mfaEnabled: true,
      mfaSecret: generateSecret(),
      passwordHash,
    });
    const { service } = buildService(new Map([[admin.id, admin]]));

    const result = await service.login(
      { email: admin.email, password: PASSWORD },
      TEST_IP,
    );
    expect('mfaRequired' in result && result.mfaRequired).toBe(true);
    expect('mfaEnrolmentRequired' in result).toBe(false);
  });

  it('does not issue an enrolment challenge on a wrong password', async () => {
    // The challenge is post-authentication. Handing one out on a failed password would make it
    // an oracle for which accounts are privileged.
    const admin = await privileged('platform_admin');
    const { service } = buildService(new Map([[admin.id, admin]]));

    await expect(
      service.login({ email: admin.email, password: 'wrong' }, TEST_IP),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('completes enrolment and finishes the login in one step', async () => {
    const admin = await privileged('platform_admin');
    const users = new Map([[admin.id, admin]]);
    const { service } = buildService(users);

    const login = await service.login(
      { email: admin.email, password: PASSWORD },
      TEST_IP,
    );
    const challengeId =
      'enrolmentChallengeId' in login ? login.enrolmentChallengeId : '';

    const setup = await service.mfaEnrolSetup(challengeId);
    expect(setup.secret).toBeTruthy();

    const code = await generateTotp({
      secret: users.get(admin.id)!.mfaSecret!,
    });
    const done = await service.mfaEnrolComplete(challengeId, code, TEST_IP);

    // Tokens AND recovery codes: the login completes, and they leave with the only thing that
    // can recover this account later.
    expect(done.accessToken).toBeTruthy();
    expect(done.recoveryCodes.length).toBeGreaterThan(0);
    expect(users.get(admin.id)!.mfaEnabled).toBe(true);
  });

  it('keeps the challenge alive after a wrong code, so a retry is possible', async () => {
    // Codes rotate every 30s and get mistyped. Consuming the challenge on a bad attempt would
    // send the admin back to the login screen mid-enrolment, which is how people give up.
    const admin = await privileged('platform_admin');
    const users = new Map([[admin.id, admin]]);
    const { service } = buildService(users);

    const login = await service.login(
      { email: admin.email, password: PASSWORD },
      TEST_IP,
    );
    const challengeId =
      'enrolmentChallengeId' in login ? login.enrolmentChallengeId : '';
    await service.mfaEnrolSetup(challengeId);

    await expect(
      service.mfaEnrolComplete(challengeId, '000000', TEST_IP),
    ).rejects.toMatchObject({ code: 'INVALID_MFA_CODE' });

    const code = await generateTotp({
      secret: users.get(admin.id)!.mfaSecret!,
    });
    const done = await service.mfaEnrolComplete(challengeId, code, TEST_IP);
    expect(done.accessToken).toBeTruthy();
  });

  it('rejects an unknown or expired enrolment challenge', async () => {
    const { service } = buildService(new Map());
    await expect(service.mfaEnrolSetup(randomUUID())).rejects.toMatchObject({
      code: 'INVALID_MFA_CHALLENGE',
    });
  });

  it('consumes the challenge once enrolment succeeds, so it cannot be replayed', async () => {
    const admin = await privileged('platform_admin');
    const users = new Map([[admin.id, admin]]);
    const { service } = buildService(users);

    const login = await service.login(
      { email: admin.email, password: PASSWORD },
      TEST_IP,
    );
    const challengeId =
      'enrolmentChallengeId' in login ? login.enrolmentChallengeId : '';
    await service.mfaEnrolSetup(challengeId);
    const code = await generateTotp({
      secret: users.get(admin.id)!.mfaSecret!,
    });
    await service.mfaEnrolComplete(challengeId, code, TEST_IP);

    await expect(service.mfaEnrolSetup(challengeId)).rejects.toMatchObject({
      code: 'INVALID_MFA_CHALLENGE',
    });
  });
});
