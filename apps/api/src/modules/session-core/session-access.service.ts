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

  async getOwnedSession(
    sessionId: string,
    user: AuthenticatedUser,
  ): Promise<InvestigationSession> {
    const session = await this.prisma.investigationSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new AppException(404, 'NOT_FOUND', 'Session not found.');
    }
    if (session.userId === user.id) return session;
    if (user.role === 'platform_admin') return session;

    // §15.2: an instructor may read a Student's session only if it belongs to a cohort
    // assignment on a cohort that instructor owns — never a blanket cross-session bypass,
    // since unauthorized read of another Student's session leaks ground-truth-adjacent
    // information (§12.3) and would undermine assessment integrity.
    if (user.role === 'instructor' && session.cohortAssignmentId) {
      const assignment = await this.prisma.cohortScenarioAssignment.findUnique({
        where: { id: session.cohortAssignmentId },
        include: { cohort: true },
      });
      if (assignment && assignment.cohort.ownerId === user.id) return session;
    }

    throw new AppException(
      403,
      'FORBIDDEN',
      'You do not have access to this session.',
    );
  }
}
