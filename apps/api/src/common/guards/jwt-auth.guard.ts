import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AppException } from '../exceptions/app-exception';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuthenticatedUser {
  id: string;
  role: string;
  orgId: string | null;
  sessionVersion: number;
}

// Verifies the bearer JWT and attaches the caller to the request (§5.7, §15.2).
// Coarse role-route checks live in RolesGuard; this guard only establishes identity.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.header('authorization');
    const token = header?.startsWith('Bearer ')
      ? header.slice('Bearer '.length)
      : null;

    if (!token) {
      throw new AppException(401, 'UNAUTHENTICATED', 'Missing bearer token.');
    }

    let payload: {
      sub: string;
      role: string;
      org_id: string | null;
      session_version: number;
    };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new AppException(
        401,
        'UNAUTHENTICATED',
        'Invalid or expired access token.',
      );
    }

    // §15.7: session_version is bumped by password reset, logout-all, MFA changes and the
    // admin CLI scripts, and the architecture doc states that "instantly invalidates all
    // previously-issued access tokens". Verifying the signature alone did not make that true —
    // a token issued before the bump stayed valid for the rest of its 15-minute TTL, so
    // revoking a compromised session did not actually revoke it.
    //
    // Read live rather than cached. The two admin CLI scripts (admin:grant, admin:reset-mfa)
    // bump this from outside the running app, so any in-process or Redis cache would go stale
    // in exactly the break-glass situation where revocation matters most. This costs one
    // primary-key lookup per authenticated request, which is the honest price of the claim.
    const current = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { sessionVersion: true, status: true },
    });

    if (!current || current.sessionVersion !== payload.session_version) {
      throw new AppException(
        401,
        'SESSION_REVOKED',
        'This session has been signed out. Sign in again.',
      );
    }

    // Checked here too, so disabling an account takes effect on the next request rather than
    // when its current token happens to expire.
    if (current.status !== 'active') {
      throw new AppException(
        403,
        'ACCOUNT_NOT_ACTIVE',
        'This account is not active.',
      );
    }

    request.user = {
      id: payload.sub,
      role: payload.role,
      orgId: payload.org_id,
      sessionVersion: payload.session_version,
    };
    return true;
  }
}
