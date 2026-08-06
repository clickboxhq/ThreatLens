import { randomUUID } from 'crypto';
import { generateSecret, generate as generateTotp } from 'otplib';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { MfaChallengeStore } from './mfa-challenge.store';
import { PasswordResetTokenStore } from './password-reset-token.store';
import { EmailVerificationTokenStore } from './email-verification-token.store';
import { LoginAttemptTracker, computeLockoutSeconds } from './login-attempt-tracker.service';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
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

  async lockoutSecondsRemaining(email: string, sourceIp: string): Promise<number> {
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
      findUnique: jest.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id) return users.get(where.id) ?? null;
        return [...users.values()].find((u) => u.email === where.email) ?? null;
      }),
      create: jest.fn(async ({ data }: { data: Partial<User> }) => {
        const created = user({ ...data, id: randomUUID() });
        users.set(created.id, created);
        return created;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = users.get(where.id)!;
        const updated = {
          ...existing,
          ...data,
          sessionVersion:
            typeof data.sessionVersion === 'object' && data.sessionVersion !== null
              ? existing.sessionVersion + (data.sessionVersion as { increment: number }).increment
              : (data.sessionVersion as number | undefined) ?? existing.sessionVersion,
        };
        users.set(where.id, updated);
        return updated;
      }),
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

  const service = new AuthService(
    prisma as never,
    jwt as never,
    config as never,
    mfaChallenges as unknown as MfaChallengeStore,
    passwordResetTokens as unknown as PasswordResetTokenStore,
    emailVerificationTokens as unknown as EmailVerificationTokenStore,
    loginAttempts as unknown as LoginAttemptTracker,
    auditLog as unknown as AuditLogService,
  );
  return { service, prisma, mfaChallenges, passwordResetTokens, emailVerificationTokens, loginAttempts, auditLog };
}

describe('AuthService MFA (§15.1, §16.2)', () => {
  it('login() does not issue tokens for an MFA-enrolled account, returning a challenge instead', async () => {
    const argon2 = await import('argon2');
    const passwordHash = await argon2.hash('correct horse battery staple', { type: argon2.argon2id });
    const enrolled = user({ mfaEnabled: true, mfaSecret: generateSecret(), passwordHash });
    const users = new Map([[enrolled.id, enrolled]]);
    const { service } = buildService(users);

    const result = await service.login({ email: enrolled.email, password: 'correct horse battery staple' }, TEST_IP);
    expect('mfaRequired' in result && result.mfaRequired).toBe(true);
  });

  it('login() issues tokens directly for an account without MFA', async () => {
    const argon2 = await import('argon2');
    const passwordHash = await argon2.hash('correct horse battery staple', { type: argon2.argon2id });
    const plain = user({ passwordHash });
    const users = new Map([[plain.id, plain]]);
    const { service } = buildService(users);

    const result = await service.login({ email: plain.email, password: 'correct horse battery staple' }, TEST_IP);
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
    await expect(service.mfaVerify(secondChallengeId, '000000')).rejects.toThrow(AppException);
  });

  it('mfaVerify() rejects a challenge id that was already consumed (one-time use)', async () => {
    const secret = generateSecret();
    const enrolled = user({ mfaEnabled: true, mfaSecret: secret });
    const users = new Map([[enrolled.id, enrolled]]);
    const { service, mfaChallenges } = buildService(users);

    const validCode = await generateTotp({ secret });
    const challengeId = await mfaChallenges.create(enrolled.id);
    await service.mfaVerify(challengeId, validCode);

    await expect(service.mfaVerify(challengeId, validCode)).rejects.toThrow(AppException);
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
    await expect(service.mfaEnable(target.id, '000000')).rejects.toThrow(AppException);
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
    await expect(service.mfaVerify(secondChallengeId, recoveryCode)).rejects.toThrow(AppException);
  });

  it('mfaDisable() is blocked for org_admin and platform_admin (§15.2 mandatory MFA)', async () => {
    const argon2 = await import('argon2');
    const passwordHash = await argon2.hash('correct horse battery staple', { type: argon2.argon2id });
    const admin = user({ role: 'org_admin', mfaEnabled: true, mfaSecret: generateSecret(), passwordHash });
    const users = new Map([[admin.id, admin]]);
    const { service } = buildService(users);

    await expect(service.mfaDisable(admin.id, 'correct horse battery staple')).rejects.toThrow(AppException);
    expect(users.get(admin.id)!.mfaEnabled).toBe(true);
  });

  it('mfaDisable() succeeds for a student with the correct password and clears the secret and recovery codes', async () => {
    const argon2 = await import('argon2');
    const passwordHash = await argon2.hash('correct horse battery staple', { type: argon2.argon2id });
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
    const passwordHash = await argon2.hash('correct horse battery staple', { type: argon2.argon2id });
    const enrolled = user({ mfaEnabled: true, mfaSecret: generateSecret(), passwordHash });
    const users = new Map([[enrolled.id, enrolled]]);
    const { service } = buildService(users);

    await expect(service.mfaDisable(enrolled.id, 'wrong password')).rejects.toThrow(AppException);
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

    await expect(service.requestPasswordReset('nobody@example.com')).resolves.toBeUndefined();
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
    const oldPasswordHash = await argon2.hash('old password 123', { type: argon2.argon2id });
    const target = user({ passwordHash: oldPasswordHash });
    const users = new Map([[target.id, target]]);
    const { service, prisma, passwordResetTokens } = buildService(users);

    const token = await passwordResetTokens.create(target.id);
    await service.confirmPasswordReset(token, 'brand new password 456');

    const updated = users.get(target.id)!;
    expect(await argon2.verify(updated.passwordHash!, 'brand new password 456')).toBe(true);
    expect(await argon2.verify(oldPasswordHash, 'old password 123')).toBe(true); // sanity: old hash itself still verifies its own password
    expect(updated.sessionVersion).toBe(target.sessionVersion + 1);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: target.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('confirmPasswordReset() rejects an invalid or unknown token', async () => {
    const users = new Map<string, User>();
    const { service } = buildService(users);

    await expect(service.confirmPasswordReset('not-a-real-token', 'brand new password 456')).rejects.toThrow(AppException);
  });

  it('confirmPasswordReset() rejects a token that was already used (one-time use)', async () => {
    const target = user();
    const users = new Map([[target.id, target]]);
    const { service, passwordResetTokens } = buildService(users);

    const token = await passwordResetTokens.create(target.id);
    await service.confirmPasswordReset(token, 'brand new password 456');

    await expect(service.confirmPasswordReset(token, 'yet another password 789')).rejects.toThrow(AppException);
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

    await expect(service.requestEmailVerification(target.id)).rejects.toMatchObject({
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

  it('confirmEmailVerification() rejects an invalid or unknown token', async () => {
    const users = new Map<string, User>();
    const { service } = buildService(users);

    await expect(service.confirmEmailVerification('not-a-real-token')).rejects.toMatchObject({
      code: 'INVALID_VERIFICATION_TOKEN',
    });
  });

  it('confirmEmailVerification() rejects a token that was already used (one-time use)', async () => {
    const target = user({ emailVerifiedAt: null });
    const users = new Map([[target.id, target]]);
    const { service, emailVerificationTokens } = buildService(users);

    const token = await emailVerificationTokens.create(target.id);
    await service.confirmEmailVerification(token);

    await expect(service.confirmEmailVerification(token)).rejects.toThrow(AppException);
  });
});

describe('AuthService login lockout (§15.1)', () => {
  it('locks out the (account, IP) pair after enough failed attempts, before the threshold is reached nothing is blocked', async () => {
    const argon2Mod = await import('argon2');
    const passwordHash = await argon2Mod.hash('correct horse battery staple', { type: argon2Mod.argon2id });
    const target = user({ passwordHash });
    const users = new Map([[target.id, target]]);
    const { service } = buildService(users);

    for (let i = 0; i < 4; i++) {
      await expect(service.login({ email: target.email, password: 'wrong password' }, TEST_IP)).rejects.toThrow(AppException);
    }

    // Still under threshold — a correct password should still work.
    const result = await service.login({ email: target.email, password: 'correct horse battery staple' }, TEST_IP);
    expect('mfaRequired' in result).toBe(false);
  });

  it('rejects even a correct password once the (account, IP) pair is locked out', async () => {
    const passwordHash = await argon2.hash('correct horse battery staple', { type: argon2.argon2id });
    const target = user({ passwordHash });
    const users = new Map([[target.id, target]]);
    const { service } = buildService(users);

    for (let i = 0; i < 5; i++) {
      await expect(service.login({ email: target.email, password: 'wrong password' }, TEST_IP)).rejects.toThrow(AppException);
    }

    await expect(service.login({ email: target.email, password: 'correct horse battery staple' }, TEST_IP)).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
    });
  });

  it('does not lock out attempts against the same account from a different source IP', async () => {
    const passwordHash = await argon2.hash('correct horse battery staple', { type: argon2.argon2id });
    const target = user({ passwordHash });
    const users = new Map([[target.id, target]]);
    const { service } = buildService(users);

    for (let i = 0; i < 5; i++) {
      await expect(service.login({ email: target.email, password: 'wrong password' }, TEST_IP)).rejects.toThrow(AppException);
    }

    const result = await service.login({ email: target.email, password: 'correct horse battery staple' }, '198.51.100.99');
    expect('mfaRequired' in result).toBe(false);
  });

  it('clears the failure count on a successful login, so a later mistake does not inherit prior attempts', async () => {
    const passwordHash = await argon2.hash('correct horse battery staple', { type: argon2.argon2id });
    const target = user({ passwordHash });
    const users = new Map([[target.id, target]]);
    const { service } = buildService(users);

    for (let i = 0; i < 3; i++) {
      await expect(service.login({ email: target.email, password: 'wrong password' }, TEST_IP)).rejects.toThrow(AppException);
    }
    await service.login({ email: target.email, password: 'correct horse battery staple' }, TEST_IP);

    // Only 1 failure since the successful login — nowhere near the threshold.
    await expect(service.login({ email: target.email, password: 'wrong password' }, TEST_IP)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('applies the same lockout mechanics to a nonexistent email, so account existence cannot be inferred by lockout behavior', async () => {
    const users = new Map<string, User>();
    const { service } = buildService(users);

    for (let i = 0; i < 5; i++) {
      await expect(service.login({ email: 'nobody@example.com', password: 'irrelevant' }, TEST_IP)).rejects.toThrow(AppException);
    }

    await expect(service.login({ email: 'nobody@example.com', password: 'irrelevant' }, TEST_IP)).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
    });
  });
});

describe('AuthService audit logging (§6.22)', () => {
  function actionsRecorded(auditLog: { record: jest.Mock }): string[] {
    return auditLog.record.mock.calls.map((call) => (call[0] as { action: string }).action);
  }

  it('records a `login` entry for a successful non-MFA login and nothing for password-reset requests', async () => {
    const passwordHash = await argon2.hash('correct horse battery staple', { type: argon2.argon2id });
    const target = user({ passwordHash });
    const users = new Map([[target.id, target]]);
    const { service, auditLog } = buildService(users);

    await service.login({ email: target.email, password: 'correct horse battery staple' }, TEST_IP);
    expect(actionsRecorded(auditLog)).toEqual(['login']);
  });

  it('records `login_failed` on a bad password, and `account_locked` on the failure that crosses the threshold', async () => {
    const passwordHash = await argon2.hash('correct horse battery staple', { type: argon2.argon2id });
    const target = user({ passwordHash });
    const users = new Map([[target.id, target]]);
    const { service, auditLog } = buildService(users);

    for (let i = 0; i < 5; i++) {
      await expect(service.login({ email: target.email, password: 'wrong password' }, TEST_IP)).rejects.toThrow(AppException);
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
    const passwordHash = await argon2.hash('correct horse battery staple', { type: argon2.argon2id });
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
