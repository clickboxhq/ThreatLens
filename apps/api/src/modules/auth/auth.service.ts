import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app-exception';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import type { User } from '@prisma/client';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// §18.2: every branch here — success, bad password, locked account, token reuse —
// is a distinct, tested path, since auth is the highest-consequence code in the service.
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
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
        role: 'student',
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

  async login(dto: LoginDto): Promise<TokenPair & { user: { id: string; displayName: string; role: string } }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      throw new AppException(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new AppException(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    if (user.status !== 'active') {
      throw new AppException(403, 'ACCOUNT_NOT_ACTIVE', 'This account is not active.');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const tokens = await this.issueTokenPair(user);
    return { ...tokens, user: { id: user.id, displayName: user.displayName, role: user.role } };
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
