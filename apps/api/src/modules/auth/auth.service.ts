import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { generateSecret as generateTotpSecret, generateURI as generateTotpUri, verify as verifyTotp } from 'otplib';
import * as QRCode from 'qrcode';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app-exception';
import { MfaChallengeStore } from './mfa-challenge.store';
import { PasswordResetTokenStore } from './password-reset-token.store';
import { LoginAttemptTracker } from './login-attempt-tracker.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import type { User } from '@prisma/client';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type LoginResult =
  | (TokenPair & { user: { id: string; displayName: string; role: string } })
  | { mfaRequired: true; mfaChallengeId: string };

const MFA_ISSUER = 'SOCVerse';
const RECOVERY_CODE_COUNT = 10;
// §15.2: mandatory MFA for the two privileged roles, given their access breadth.
const MFA_MANDATORY_ROLES = new Set(['org_admin', 'platform_admin']);
// ±1 time step (30s) of clock-drift tolerance, matching the classic otplib `window: 1` default.
const TOTP_EPOCH_TOLERANCE_SECONDS = 30;

async function verifyTotpCode(code: string, secret: string): Promise<boolean> {
  try {
    // otplib throws (rather than returning { valid: false }) for malformed input — e.g. a
    // pasted recovery code, which isn't 6 digits. Any such input is simply an invalid code.
    const result = await verifyTotp({ secret, token: code, epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS });
    return result.valid;
  } catch {
    return false;
  }
}

// §18.2: every branch here — success, bad password, locked account, token reuse —
// is a distinct, tested path, since auth is the highest-consequence code in the service.
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mfaChallenges: MfaChallengeStore,
    private readonly passwordResetTokens: PasswordResetTokenStore,
    private readonly loginAttempts: LoginAttemptTracker,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new AppException(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        role: dto.role ?? 'student',
        status: 'active',
        // Skeleton scope: no transactional email provider is wired up yet (§5.9's `email`
        // queue is a later milestone), so accounts are auto-verified rather than left in
        // `pending_verification` with no way to complete verification. Revisit once email
        // delivery exists, per §15.1's documented requirement.
        emailVerifiedAt: new Date(),
      },
    });

    return { userId: user.id, emailVerificationRequired: false };
  }

  async login(dto: LoginDto, sourceIp: string): Promise<LoginResult> {
    // §15.1: checked before touching the password at all — a locked-out (account, IP) pair
    // gets rejected outright, so a lockout can't be probed away by simply retrying faster.
    const lockoutSeconds = await this.loginAttempts.lockoutSecondsRemaining(dto.email, sourceIp);
    if (lockoutSeconds > 0) {
      throw new AppException(
        423,
        'ACCOUNT_LOCKED',
        `Too many failed attempts. Try again in ${lockoutSeconds} seconds.`,
        { 'Retry-After': String(lockoutSeconds) },
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      await this.loginAttempts.recordFailure(dto.email, sourceIp);
      throw new AppException(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      await this.loginAttempts.recordFailure(dto.email, sourceIp);
      throw new AppException(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    if (user.status !== 'active') {
      throw new AppException(403, 'ACCOUNT_NOT_ACTIVE', 'This account is not active.');
    }

    await this.loginAttempts.clear(dto.email, sourceIp);

    // §15.1: MFA is enforced at login, not just offered — the password alone never completes
    // authentication for an MFA-enrolled account. Tokens are issued only from mfaVerify().
    if (user.mfaEnabled) {
      const mfaChallengeId = await this.mfaChallenges.create(user.id);
      return { mfaRequired: true, mfaChallengeId };
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const tokens = await this.issueTokenPair(user);
    return { ...tokens, user: { id: user.id, displayName: user.displayName, role: user.role } };
  }

  /** Completes login for an MFA-enrolled account (§16.2 `POST /auth/mfa/verify`). */
  async mfaVerify(mfaChallengeId: string, code: string): Promise<TokenPair & { user: { id: string; displayName: string; role: string } }> {
    const userId = await this.mfaChallenges.consume(mfaChallengeId);
    if (!userId) {
      throw new AppException(401, 'MFA_CHALLENGE_EXPIRED', 'This MFA challenge has expired or was already used. Please log in again.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.mfaEnabled || !user.mfaSecret || user.status !== 'active') {
      throw new AppException(401, 'INVALID_CREDENTIALS', 'Unable to complete sign-in.');
    }

    const usedRecoveryCode = await this.tryConsumeRecoveryCode(user, code);
    if (!usedRecoveryCode && !(await verifyTotpCode(code, user.mfaSecret))) {
      throw new AppException(401, 'INVALID_MFA_CODE', 'That code is incorrect or has expired.');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const tokens = await this.issueTokenPair(user);
    return { ...tokens, user: { id: user.id, displayName: user.displayName, role: user.role } };
  }

  /** §16.2 `POST /auth/mfa/setup`: generates a pending secret; MFA only takes effect once mfaEnable() verifies it. */
  async mfaSetup(userId: string): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException(404, 'NOT_FOUND', 'User not found.');

    const secret = generateTotpSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret } });

    const otpauthUrl = generateTotpUri({ issuer: MFA_ISSUER, label: user.email, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  /** §16.2 `POST /auth/mfa/enable`: verifies the pending secret and turns MFA on, issuing one-time recovery codes. */
  async mfaEnable(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) {
      throw new AppException(400, 'MFA_NOT_SET_UP', 'Call /auth/mfa/setup first.');
    }
    if (user.mfaEnabled) {
      throw new AppException(409, 'MFA_ALREADY_ENABLED', 'MFA is already enabled on this account.');
    }
    if (!(await verifyTotpCode(code, user.mfaSecret))) {
      throw new AppException(401, 'INVALID_MFA_CODE', 'That code is incorrect or has expired.');
    }

    const recoveryCodes = generateRecoveryCodes();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaRecoveryCodesHash: recoveryCodes.map(hashRecoveryCode),
        sessionVersion: { increment: 1 }, // §15.7: MFA change invalidates other active sessions.
      },
    });

    return { recoveryCodes };
  }

  /** §16.2 `POST /auth/mfa/disable`. Blocked for the roles §15.1 makes MFA mandatory for. */
  async mfaDisable(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new AppException(401, 'INVALID_CREDENTIALS', 'Invalid password.');
    }
    if (MFA_MANDATORY_ROLES.has(user.role)) {
      throw new AppException(403, 'MFA_MANDATORY_FOR_ROLE', 'MFA cannot be disabled for this account\'s role.');
    }
    if (!(await argon2.verify(user.passwordHash, password))) {
      throw new AppException(401, 'INVALID_CREDENTIALS', 'Invalid password.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaRecoveryCodesHash: [],
        sessionVersion: { increment: 1 },
      },
    });
  }

  async mfaStatus(userId: string): Promise<{ enabled: boolean; mandatory: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException(404, 'NOT_FOUND', 'User not found.');
    return { enabled: user.mfaEnabled, mandatory: MFA_MANDATORY_ROLES.has(user.role) };
  }

  /**
   * §16.2 `POST /auth/password-reset/request`. Always resolves the same way regardless of
   * whether the email matches an account — a distinguishable response here is a user-
   * enumeration vector, which matters as much for a reset flow as it does for login (§15.1).
   *
   * No transactional email provider is wired up yet (§5.9's `email` queue is a later
   * milestone, same gap noted on `signup`'s auto-verification) — the reset link is logged
   * server-side as a stand-in for the email that would otherwise deliver it.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash || user.status !== 'active') {
      return;
    }

    const token = await this.passwordResetTokens.create(user.id);
    const resetUrl = `${this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173'}/reset-password?token=${token}`;
    this.logger.log(`Password reset requested for ${user.email}. Link (stands in for an emailed link): ${resetUrl}`);
  }

  /** §16.2 `POST /auth/password-reset/confirm`. Consumes the token and revokes every other active session. */
  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    const userId = await this.passwordResetTokens.consume(token);
    if (!userId) {
      throw new AppException(401, 'INVALID_RESET_TOKEN', 'This reset link is invalid or has expired.');
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, sessionVersion: { increment: 1 } },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async tryConsumeRecoveryCode(user: User, code: string): Promise<boolean> {
    if (user.mfaRecoveryCodesHash.length === 0) return false;
    const hash = hashRecoveryCode(code);
    const index = user.mfaRecoveryCodesHash.indexOf(hash);
    if (index === -1) return false;

    const remaining = [...user.mfaRecoveryCodesHash];
    remaining.splice(index, 1);
    await this.prisma.user.update({ where: { id: user.id }, data: { mfaRecoveryCodesHash: remaining } });
    return true;
  }

  async refresh(rawToken: string): Promise<TokenPair> {
    const tokenHash = hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!existing) {
      throw new AppException(401, 'INVALID_REFRESH_TOKEN', 'Refresh token not recognized.');
    }

    if (existing.revokedAt || existing.expiresAt < new Date()) {
      throw new AppException(401, 'INVALID_REFRESH_TOKEN', 'Refresh token has been revoked or expired.');
    }

    if (existing.replacedByTokenId) {
      // §15.7: presenting an already-rotated-away token indicates theft/replay.
      // Revoke the entire chain and force re-authentication.
      await this.revokeChainFrom(existing.id);
      throw new AppException(401, 'REFRESH_TOKEN_REUSE_DETECTED', 'This refresh token was already used. Please log in again.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: existing.userId } });
    if (!user || user.status !== 'active') {
      throw new AppException(401, 'INVALID_REFRESH_TOKEN', 'Account is not active.');
    }

    const tokens = await this.issueTokenPair(user, existing.id);
    return tokens;
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { sessionVersion: { increment: 1 } },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async issueTokenPair(user: User, replacesTokenId?: string): Promise<TokenPair> {
    const accessTtlSeconds = Number(this.config.get('JWT_ACCESS_TTL_SECONDS') ?? 900);
    const refreshTtlDays = Number(this.config.get('JWT_REFRESH_TTL_DAYS') ?? 30);

    const accessToken = this.jwt.sign(
      {
        sub: user.id,
        role: user.role,
        org_id: user.orgId,
        session_version: user.sessionVersion,
      },
      { expiresIn: accessTtlSeconds },
    );

    const rawRefreshToken = randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

    const newToken = await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    if (replacesTokenId) {
      await this.prisma.refreshToken.update({
        where: { id: replacesTokenId },
        data: { revokedAt: new Date(), replacedByTokenId: newToken.id },
      });
    }

    return { accessToken, refreshToken: rawRefreshToken, expiresIn: accessTtlSeconds };
  }

  private async revokeChainFrom(tokenId: string): Promise<void> {
    let current = await this.prisma.refreshToken.findUnique({ where: { id: tokenId } });
    const visited = new Set<string>();
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      if (!current.revokedAt) {
        await this.prisma.refreshToken.update({
          where: { id: current.id },
          data: { revokedAt: new Date() },
        });
      }
      current = current.replacedByTokenId
        ? await this.prisma.refreshToken.findUnique({ where: { id: current.replacedByTokenId } })
        : null;
    }
  }
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = randomBytes(5).toString('hex').toUpperCase(); // 10 hex chars
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
  });
}

function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}
