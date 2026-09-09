import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import {
  generateSecret as generateTotpSecret,
  generateURI as generateTotpUri,
  verify as verifyTotp,
} from 'otplib';
import * as QRCode from 'qrcode';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app-exception';
import {
  verificationEmail,
  welcomeEmail,
  passwordResetEmail,
} from '../../common/email/email-templates';
import { MfaChallengeStore } from './mfa-challenge.store';
import { PasswordResetTokenStore } from './password-reset-token.store';
import { EmailVerificationTokenStore } from './email-verification-token.store';
import { LoginAttemptTracker } from './login-attempt-tracker.service';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
import { EmailService } from '../../common/email/email.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import type { User } from '@prisma/client';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * The signed-in user, as every route that returns one must return it.
 *
 * Login used to return a four-field subset — id, displayName, role, emailVerified — while
 * GET /auth/me returned the profile as well. The client caches whatever login hands back, so
 * after signing in it held a user with no avatar and no first/last name, and rendered the
 * defaults for both: initials instead of the uploaded picture, and the signup displayName
 * instead of the name the person had set. Editing a profile appeared to work and then appeared
 * to forget, because nothing re-read the profile after login.
 */
export interface AuthUserDto {
  id: string;
  email: string;
  displayName: string;
  role: string;
  emailVerified: boolean;
  createdAt: Date;
  firstName: string | null;
  lastName: string | null;
  professionalRole: string | null;
  bio: string | null;
  careerGoal: string | null;
  experienceLevel: string | null;
  avatarType: string;
  avatarPresetKey: string | null;
  avatarDataUrl: string | null;
  careerLevel: string;
}

/** The one place the signed-in user's shape is defined, so login and GET /auth/me cannot drift. */
function toAuthUserDto(user: {
  id: string;
  email: string;
  displayName: string;
  role: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  firstName: string | null;
  lastName: string | null;
  professionalRole: string | null;
  bio: string | null;
  careerGoal: string | null;
  experienceLevel: string | null;
  avatarType: string;
  avatarPresetKey: string | null;
  avatarDataUrl: string | null;
  careerLevel: string;
}): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    emailVerified: user.emailVerifiedAt !== null,
    createdAt: user.createdAt,
    firstName: user.firstName,
    lastName: user.lastName,
    professionalRole: user.professionalRole,
    bio: user.bio,
    careerGoal: user.careerGoal,
    experienceLevel: user.experienceLevel,
    avatarType: user.avatarType,
    avatarPresetKey: user.avatarPresetKey,
    avatarDataUrl: user.avatarDataUrl,
    careerLevel: user.careerLevel,
  };
}

export type LoginResult =
  | (TokenPair & { user: AuthUserDto })
  | { mfaRequired: true; mfaChallengeId: string }
  // A privileged account that has not enrolled MFA yet. Distinct from mfaRequired: nothing to
  // verify against, so the client must take the caller through enrolment before login can
  // complete.
  | { mfaEnrolmentRequired: true; enrolmentChallengeId: string };

const MFA_ISSUER = 'ThreatLens';
const RECOVERY_CODE_COUNT = 10;
// §15.2: mandatory MFA for the two privileged roles, given their access breadth.
const MFA_MANDATORY_ROLES = new Set(['org_admin', 'platform_admin']);
// ±1 time step (30s) of clock-drift tolerance, matching the classic otplib `window: 1` default.
const TOTP_EPOCH_TOLERANCE_SECONDS = 30;

async function verifyTotpCode(code: string, secret: string): Promise<boolean> {
  try {
    // otplib throws (rather than returning { valid: false }) for malformed input — e.g. a
    // pasted recovery code, which isn't 6 digits. Any such input is simply an invalid code.
    const result = await verifyTotp({
      secret,
      token: code,
      epochTolerance: TOTP_EPOCH_TOLERANCE_SECONDS,
    });
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
    private readonly emailVerificationTokens: EmailVerificationTokenStore,
    private readonly loginAttempts: LoginAttemptTracker,
    private readonly auditLog: AuditLogService,
    private readonly emailService: EmailService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new AppException(
        409,
        'EMAIL_TAKEN',
        'An account with this email already exists.',
      );
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        role: dto.role ?? 'student',
        status: 'active',
        // §15.1: unverified accounts can still log in and explore (checked only at
        // session-start, in SessionsService.createSession), so leaving this unset here
        // doesn't lock the Student out of anything but starting a scored scenario.
        emailVerifiedAt: null,
      },
    });

    await this.sendVerificationEmail(user.id, user.email);

    return { userId: user.id, emailVerificationRequired: true };
  }

  private async sendVerificationEmail(
    userId: string,
    email: string,
  ): Promise<void> {
    const token = await this.emailVerificationTokens.create(userId);
    // Path param, not a ?token= query string — matches the ThreatLens frontend's
    // /verify-email/$token route (apps/web/src/routes/verify-email.$token.tsx).
    const verifyUrl = `${this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173'}/verify-email/${token}`;
    await this.emailService.send({
      to: email,
      ...verificationEmail(verifyUrl),
    });
  }

  /** §16.2 `POST /auth/email-verification/request`: resend for the currently authenticated user. */
  async requestEmailVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException(404, 'NOT_FOUND', 'User not found.');
    if (user.emailVerifiedAt) {
      throw new AppException(
        409,
        'EMAIL_ALREADY_VERIFIED',
        'This email address is already verified.',
      );
    }
    await this.sendVerificationEmail(user.id, user.email);
  }

  /** §16.2 `POST /auth/email-verification/confirm`. */
  async confirmEmailVerification(
    token: string,
    sourceIp?: string,
    correlationId?: string,
  ): Promise<void> {
    const userId = await this.emailVerificationTokens.consume(token);
    if (!userId) {
      throw new AppException(
        401,
        'INVALID_VERIFICATION_TOKEN',
        'This verification link is invalid or has expired.',
      );
    }

    // updateMany with emailVerifiedAt: null in the where clause, rather than update by id,
    // so the row itself decides whether this is the first verification. A user who requested
    // a second link before using the first holds two valid tokens, and both would otherwise
    // consume successfully and send two welcome emails.
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });

    await this.auditLog.record({
      actorUserId: userId,
      actorIp: sourceIp,
      action: 'email_verified',
      targetType: 'user',
      targetId: userId,
      correlationId,
    });

    if (count === 1) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, displayName: true },
      });
      if (user) {
        const appUrl = `${this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173'}/app/scenarios`;
        await this.emailService.send({
          to: user.email,
          ...welcomeEmail({ displayName: user.displayName, appUrl }),
        });
      }
    }
  }

  async login(
    dto: LoginDto,
    sourceIp: string,
    correlationId?: string,
  ): Promise<LoginResult> {
    // §15.1: checked before touching the password at all — a locked-out (account, IP) pair
    // gets rejected outright, so a lockout can't be probed away by simply retrying faster.
    const lockoutSeconds = await this.loginAttempts.lockoutSecondsRemaining(
      dto.email,
      sourceIp,
    );
    if (lockoutSeconds > 0) {
      throw new AppException(
        423,
        'ACCOUNT_LOCKED',
        `Too many failed attempts. Try again in ${lockoutSeconds} seconds.`,
        { 'Retry-After': String(lockoutSeconds) },
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.passwordHash) {
      await this.recordLoginFailure(dto.email, sourceIp, correlationId, null);
      throw new AppException(
        401,
        'INVALID_CREDENTIALS',
        'Invalid email or password.',
      );
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      await this.recordLoginFailure(
        dto.email,
        sourceIp,
        correlationId,
        user.id,
      );
      throw new AppException(
        401,
        'INVALID_CREDENTIALS',
        'Invalid email or password.',
      );
    }

    if (user.status !== 'active') {
      throw new AppException(
        403,
        'ACCOUNT_NOT_ACTIVE',
        'This account is not active.',
      );
    }

    await this.loginAttempts.clear(dto.email, sourceIp);

    // §15.1: MFA is enforced at login, not just offered — the password alone never completes
    // authentication for an MFA-enrolled account. Tokens are issued only from mfaVerify(),
    // which is also where the completed-login audit entry is recorded for this path.
    if (user.mfaEnabled) {
      const mfaChallengeId = await this.mfaChallenges.create(user.id);
      return { mfaRequired: true, mfaChallengeId };
    }

    // §15.2: MFA is mandatory for the privileged roles, and this is where that is actually
    // enforced rather than merely declared. Such an account cannot complete login without
    // enrolling — but it is handed an enrolment challenge to do so, because withholding the
    // token AND requiring a token to enrol would lock the account out permanently.
    if (MFA_MANDATORY_ROLES.has(user.role)) {
      const enrolmentChallengeId = await this.mfaChallenges.createEnrolment(
        user.id,
      );
      return { mfaEnrolmentRequired: true, enrolmentChallengeId };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.auditLog.record({
      actorUserId: user.id,
      actorIp: sourceIp,
      action: 'login',
      targetType: 'user',
      targetId: user.id,
      correlationId,
    });

    const tokens = await this.issueTokenPair(user);
    return {
      ...tokens,
      user: toAuthUserDto(user),
    };
  }

  /**
   * §15.1: "an audit_logs `login_failed` entry per attempt, for anomaly review." Also detects
   * whether this specific failure is the one that pushed the (account, IP) pair into a fresh
   * lockout (it wasn't locked when `login()` checked moments ago, so if it's locked now, this
   * attempt caused it) and records a distinct `account_locked` entry for that case.
   */
  private async recordLoginFailure(
    email: string,
    sourceIp: string,
    correlationId: string | undefined,
    userId: string | null,
  ): Promise<void> {
    await this.loginAttempts.recordFailure(email, sourceIp);
    await this.auditLog.record({
      actorUserId: userId,
      actorIp: sourceIp,
      action: 'login_failed',
      targetType: 'user',
      targetId: userId,
      metadata: { email },
      correlationId,
    });

    const lockoutSeconds = await this.loginAttempts.lockoutSecondsRemaining(
      email,
      sourceIp,
    );
    if (lockoutSeconds > 0) {
      await this.auditLog.record({
        actorUserId: userId,
        actorIp: sourceIp,
        action: 'account_locked',
        targetType: 'user',
        targetId: userId,
        metadata: { email, lockoutSeconds },
        correlationId,
      });
    }
  }

  /** Completes login for an MFA-enrolled account (§16.2 `POST /auth/mfa/verify`). */
  async mfaVerify(
    mfaChallengeId: string,
    code: string,
    sourceIp?: string,
    correlationId?: string,
  ): Promise<TokenPair & { user: AuthUserDto }> {
    const userId = await this.mfaChallenges.consume(mfaChallengeId);
    if (!userId) {
      throw new AppException(
        401,
        'MFA_CHALLENGE_EXPIRED',
        'This MFA challenge has expired or was already used. Please log in again.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user ||
      !user.mfaEnabled ||
      !user.mfaSecret ||
      user.status !== 'active'
    ) {
      throw new AppException(
        401,
        'INVALID_CREDENTIALS',
        'Unable to complete sign-in.',
      );
    }

    const usedRecoveryCode = await this.tryConsumeRecoveryCode(user, code);
    if (!usedRecoveryCode && !(await verifyTotpCode(code, user.mfaSecret))) {
      // Recorded for the admin Security Events view — a run of these on one account is a
      // signal worth surfacing.
      await this.auditLog.record({
        actorUserId: user.id,
        actorIp: sourceIp,
        action: 'mfa_challenge_failed',
        targetType: 'user',
        targetId: user.id,
        correlationId,
      });
      throw new AppException(
        401,
        'INVALID_MFA_CODE',
        'That code is incorrect or has expired.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.auditLog.record({
      actorUserId: user.id,
      actorIp: sourceIp,
      action: 'login',
      targetType: 'user',
      targetId: user.id,
      metadata: { viaRecoveryCode: usedRecoveryCode },
      correlationId,
    });

    const tokens = await this.issueTokenPair(user);
    return {
      ...tokens,
      user: toAuthUserDto(user),
    };
  }

  /** §16.2 `POST /auth/mfa/setup`: generates a pending secret; MFA only takes effect once mfaEnable() verifies it. */
  async mfaSetup(
    userId: string,
  ): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException(404, 'NOT_FOUND', 'User not found.');

    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret },
    });

    const otpauthUrl = generateTotpUri({
      issuer: MFA_ISSUER,
      label: user.email,
      secret,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  /**
   * Begin enrolment for an account that is blocked at login pending MFA. Authorised by the
   * enrolment challenge rather than a token, since the token is precisely what is withheld.
   * Does not consume the challenge — a first attempt often fails on a mis-scanned QR.
   */
  async mfaEnrolSetup(
    enrolmentChallengeId: string,
  ): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const userId = await this.mfaChallenges.peekEnrolment(enrolmentChallengeId);
    if (!userId) {
      throw new AppException(
        401,
        'INVALID_MFA_CHALLENGE',
        'That enrolment session has expired. Sign in again to restart it.',
      );
    }
    return this.mfaSetup(userId);
  }

  /**
   * Complete enrolment and finish the login it was blocking, returning tokens alongside the
   * recovery codes.
   *
   * The codes matter more here than anywhere else in the product: for a role in
   * MFA_MANDATORY_ROLES the password-reset path deliberately does NOT clear MFA, so if the
   * authenticator is lost these codes are the only remaining way into the account.
   */
  async mfaEnrolComplete(
    enrolmentChallengeId: string,
    code: string,
    sourceIp?: string,
    correlationId?: string,
  ) {
    const userId = await this.mfaChallenges.peekEnrolment(enrolmentChallengeId);
    if (!userId) {
      throw new AppException(
        401,
        'INVALID_MFA_CHALLENGE',
        'That enrolment session has expired. Sign in again to restart it.',
      );
    }

    // mfaEnable does the real verification and throws on a bad code, leaving the challenge
    // intact so the caller can simply try again with the next code from their app.
    const { recoveryCodes } = await this.mfaEnable(
      userId,
      code,
      sourceIp,
      correlationId,
    );
    await this.mfaChallenges.consumeEnrolment(enrolmentChallengeId);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
    await this.auditLog.record({
      actorUserId: userId,
      actorIp: sourceIp,
      action: 'auth.mfa_enrolment_completed',
      targetType: 'user',
      targetId: userId,
      correlationId,
    });

    const tokens = await this.issueTokenPair(user);
    return { ...tokens, recoveryCodes };
  }

  /** §16.2 `POST /auth/mfa/enable`: verifies the pending secret and turns MFA on, issuing one-time recovery codes. */
  async mfaEnable(
    userId: string,
    code: string,
    sourceIp?: string,
    correlationId?: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.mfaSecret) {
      throw new AppException(
        400,
        'MFA_NOT_SET_UP',
        'Call /auth/mfa/setup first.',
      );
    }
    if (user.mfaEnabled) {
      throw new AppException(
        409,
        'MFA_ALREADY_ENABLED',
        'MFA is already enabled on this account.',
      );
    }
    if (!(await verifyTotpCode(code, user.mfaSecret))) {
      throw new AppException(
        401,
        'INVALID_MFA_CODE',
        'That code is incorrect or has expired.',
      );
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
    await this.auditLog.record({
      actorUserId: userId,
      actorIp: sourceIp,
      action: 'mfa_enabled',
      targetType: 'user',
      targetId: userId,
      correlationId,
    });

    return { recoveryCodes };
  }

  /** §16.2 `POST /auth/mfa/disable`. Blocked for the roles §15.1 makes MFA mandatory for. */
  async mfaDisable(
    userId: string,
    password: string,
    sourceIp?: string,
    correlationId?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new AppException(401, 'INVALID_CREDENTIALS', 'Invalid password.');
    }
    if (MFA_MANDATORY_ROLES.has(user.role)) {
      throw new AppException(
        403,
        'MFA_MANDATORY_FOR_ROLE',
        "MFA cannot be disabled for this account's role.",
      );
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
    await this.auditLog.record({
      actorUserId: userId,
      actorIp: sourceIp,
      action: 'mfa_disabled',
      targetType: 'user',
      targetId: userId,
      correlationId,
    });
  }

  // The JWT only ever carries id/role (§15.1) — this is the one place a Student's own email,
  // display name, and verification status can be read back, since nothing else issues them
  // after signup/login.
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException(404, 'NOT_FOUND', 'User not found.');
    return toAuthUserDto(user);
  }

  async updateProfile(
    userId: string,
    dto: {
      firstName?: string;
      lastName?: string;
      professionalRole?: string;
      bio?: string;
      careerGoal?: string;
      experienceLevel?: string;
    },
  ) {
    // displayName is what the app shows in the header, the roster, the leaderboard and every
    // instructor view. The profile form only edits firstName/lastName, so without this someone
    // changes their name, sees the profile page update, and finds the old name still on every
    // other screen — the "it forgot my name" half of the same bug.
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const firstName =
      dto.firstName !== undefined ? dto.firstName : (existing?.firstName ?? '');
    const lastName =
      dto.lastName !== undefined ? dto.lastName : (existing?.lastName ?? '');
    const derivedName = [firstName, lastName]
      .map((part) => part?.trim() ?? '')
      .filter(Boolean)
      .join(' ');

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        // Only when there is a real name to use — clearing both fields must not leave somebody
        // rendered as an empty string everywhere.
        ...(derivedName ? { displayName: derivedName } : {}),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.professionalRole !== undefined && {
          professionalRole: dto.professionalRole,
        }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.careerGoal !== undefined && { careerGoal: dto.careerGoal }),
        ...(dto.experienceLevel !== undefined && {
          experienceLevel: dto.experienceLevel as never,
        }),
      },
    });
    return this.getMe(user.id);
  }

  /** Set avatar to initials (no data needed) or one of the built-in role presets. */
  async setAvatarPreset(userId: string, presetKey: string | null) {
    await this.prisma.user.update({
      where: { id: userId },
      data: presetKey
        ? {
            avatarType: 'preset',
            avatarPresetKey: presetKey,
            avatarDataUrl: null,
          }
        : {
            avatarType: 'initials',
            avatarPresetKey: null,
            avatarDataUrl: null,
          },
    });
    return this.getMe(userId);
  }

  /** Store an uploaded avatar as a data URL — see the schema comment on
   * User.avatarDataUrl for why this isn't object-storage-backed. */
  async setAvatarUpload(userId: string, dataUrl: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        avatarType: 'upload',
        avatarDataUrl: dataUrl,
        avatarPresetKey: null,
      },
    });
    return this.getMe(userId);
  }

  async mfaStatus(
    userId: string,
  ): Promise<{ enabled: boolean; mandatory: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppException(404, 'NOT_FOUND', 'User not found.');
    return {
      enabled: user.mfaEnabled,
      mandatory: MFA_MANDATORY_ROLES.has(user.role),
    };
  }

  /**
   * §16.2 `POST /auth/password-reset/request`. Always resolves the same way regardless of
   * whether the email matches an account — a distinguishable response here is a user-
   * enumeration vector, which matters as much for a reset flow as it does for login (§15.1).
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash || user.status !== 'active') {
      return;
    }

    const token = await this.passwordResetTokens.create(user.id);
    // Path param, not a ?token= query string — matches the ThreatLens frontend's
    // /reset-password/$token route (apps/web/src/routes/reset-password.$token.tsx).
    const resetUrl = `${this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:5173'}/reset-password/${token}`;
    await this.emailService.send({
      to: user.email,
      ...passwordResetEmail(resetUrl),
    });
  }

  /** §16.2 `POST /auth/password-reset/confirm`. Consumes the token and revokes every other active session. */
  async confirmPasswordReset(
    token: string,
    newPassword: string,
    sourceIp?: string,
    correlationId?: string,
  ): Promise<void> {
    const userId = await this.passwordResetTokens.consume(token);
    if (!userId) {
      throw new AppException(
        401,
        'INVALID_RESET_TOKEN',
        'This reset link is invalid or has expired.',
      );
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
    });

    // A password reset is only reachable by clicking a real, single-use, time-limited link
    // sent to the account's registered email — the same trust level this codebase already
    // relies on to prove account ownership elsewhere. For a role where MFA is optional, that's
    // strong enough to also serve as "I lost my authenticator and have no recovery codes"
    // recovery: without clearing it here, a Student/Instructor who resets their password would
    // still be stuck at the login MFA prompt with no way to satisfy it, i.e. still fully locked
    // out. For org_admin/platform_admin, MFA is mandatory (§15.2) specifically so it can't be
    // casually removed — mirroring mfaDisable()'s own rule, a password reset does not clear it
    // for those roles, so an attacker who compromises only the mailbox still can't strip 2FA
    // off a privileged account this way.
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const clearsMfa = user.mfaEnabled && !MFA_MANDATORY_ROLES.has(user.role);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          sessionVersion: { increment: 1 },
          ...(clearsMfa
            ? { mfaEnabled: false, mfaSecret: null, mfaRecoveryCodesHash: [] }
            : {}),
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    // §6.22: `password_reset` is one of the doc's own named example actions.
    await this.auditLog.record({
      actorUserId: userId,
      actorIp: sourceIp,
      action: 'password_reset',
      targetType: 'user',
      targetId: userId,
      metadata: clearsMfa ? { mfaCleared: true } : undefined,
      correlationId,
    });
  }

  private async tryConsumeRecoveryCode(
    user: User,
    code: string,
  ): Promise<boolean> {
    if (user.mfaRecoveryCodesHash.length === 0) return false;
    const hash = hashRecoveryCode(code);
    const index = user.mfaRecoveryCodesHash.indexOf(hash);
    if (index === -1) return false;

    const remaining = [...user.mfaRecoveryCodesHash];
    remaining.splice(index, 1);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaRecoveryCodesHash: remaining },
    });
    return true;
  }

  async refresh(rawToken: string): Promise<TokenPair> {
    const tokenHash = hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!existing) {
      throw new AppException(
        401,
        'INVALID_REFRESH_TOKEN',
        'Refresh token not recognized.',
      );
    }

    if (existing.revokedAt || existing.expiresAt < new Date()) {
      throw new AppException(
        401,
        'INVALID_REFRESH_TOKEN',
        'Refresh token has been revoked or expired.',
      );
    }

    if (existing.replacedByTokenId) {
      // §15.7: presenting an already-rotated-away token indicates theft/replay.
      // Revoke the entire chain and force re-authentication.
      await this.revokeChainFrom(existing.id);
      throw new AppException(
        401,
        'REFRESH_TOKEN_REUSE_DETECTED',
        'This refresh token was already used. Please log in again.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: existing.userId },
    });
    if (!user || user.status !== 'active') {
      throw new AppException(
        401,
        'INVALID_REFRESH_TOKEN',
        'Account is not active.',
      );
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

  async logoutAll(
    userId: string,
    sourceIp?: string,
    correlationId?: string,
  ): Promise<void> {
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
    await this.auditLog.record({
      actorUserId: userId,
      actorIp: sourceIp,
      action: 'logout_all',
      targetType: 'user',
      targetId: userId,
      correlationId,
    });
  }

  private async issueTokenPair(
    user: User,
    replacesTokenId?: string,
  ): Promise<TokenPair> {
    const accessTtlSeconds = Number(
      this.config.get('JWT_ACCESS_TTL_SECONDS') ?? 900,
    );
    const refreshTtlDays = Number(
      this.config.get('JWT_REFRESH_TTL_DAYS') ?? 30,
    );

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
    const expiresAt = new Date(
      Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000,
    );

    const newToken = await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    if (replacesTokenId) {
      await this.prisma.refreshToken.update({
        where: { id: replacesTokenId },
        data: { revokedAt: new Date(), replacedByTokenId: newToken.id },
      });
    }

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: accessTtlSeconds,
    };
  }

  private async revokeChainFrom(tokenId: string): Promise<void> {
    let current = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
    });
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
        ? await this.prisma.refreshToken.findUnique({
            where: { id: current.replacedByTokenId },
          })
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
