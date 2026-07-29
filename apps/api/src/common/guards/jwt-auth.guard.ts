import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AppException } from '../exceptions/app-exception';

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
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

    if (!token) {
      throw new AppException(401, 'UNAUTHENTICATED', 'Missing bearer token.');
    }

    try {
      const payload = this.jwtService.verify<{ sub: string; role: string; org_id: string | null; session_version: number }>(
        token,
      );
      request.user = {
        id: payload.sub,
        role: payload.role,
        orgId: payload.org_id,
        sessionVersion: payload.session_version,
      };
      return true;
    } catch {
      throw new AppException(401, 'UNAUTHENTICATED', 'Invalid or expired access token.');
    }
  }
}
