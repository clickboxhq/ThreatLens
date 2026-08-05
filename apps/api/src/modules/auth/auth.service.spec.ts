import { randomUUID } from 'crypto';
import { generateSecret, generate as generateTotp } from 'otplib';
import { AuthService } from './auth.service';
import { MfaChallengeStore } from './mfa-challenge.store';
import { AppException } from '../../common/exceptions/app-exception';
import type { User } from '@prisma/client';

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

function buildService(users: Map<string, User>) {
  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id) return users.get(where.id) ?? null;
        return [...users.values()].find((u) => u.email === where.email) ?? null;
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
    },
  };

  const jwt = { sign: jest.fn(() => 'signed.jwt.token') };
  const config = { get: jest.fn(() => undefined) };
  const mfaChallenges = new FakeMfaChallengeStore();

  const service = new AuthService(prisma as never, jwt as never, config as never, mfaChallenges as unknown as MfaChallengeStore);
  return { service, prisma, mfaChallenges };
}

describe('AuthService MFA (§15.1, §16.2)', () => {
  it('login() does not issue tokens for an MFA-enrolled account, returning a challenge instead', async () => {
    const argon2 = await import('argon2');
    const passwordHash = await argon2.hash('correct horse battery staple', { type: argon2.argon2id });
    const enrolled = user({ mfaEnabled: true, mfaSecret: generateSecret(), passwordHash });
    const users = new Map([[enrolled.id, enrolled]]);
    const { service } = buildService(users);

    const result = await service.login({ email: enrolled.email, password: 'correct horse battery staple' });
    expect('mfaRequired' in result && result.mfaRequired).toBe(true);
  });

  it('login() issues tokens directly for an account without MFA', async () => {
    const argon2 = await import('argon2');
    const passwordHash = await argon2.hash('correct horse battery staple', { type: argon2.argon2id });
    const plain = user({ passwordHash });
    const users = new Map([[plain.id, plain]]);
    const { service } = buildService(users);

    const result = await service.login({ email: plain.email, password: 'correct horse battery staple' });
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
