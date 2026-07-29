import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/exceptions/app-exception';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { InvestigationSession } from '@prisma/client';

// §4.3 step 4 / §15.2: resource-level authorization, checked on every read and write
// against a session, not just at the route level.
@Injectable()
export class SessionAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnedSession(sessionId: string, user: AuthenticatedUser): Promise<InvestigationSession> {
    const session = await this.prisma.investigationSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new AppException(404, 'NOT_FOUND', 'Session not found.');
    }
    const isOwner = session.userId === user.id;
    const isPrivileged = user.role === 'instructor' || user.role === 'platform_admin';
    if (!isOwner && !isPrivileged) {
      throw new AppException(403, 'FORBIDDEN', 'You do not have access to this session.');
    }
    return session;
  }
}
