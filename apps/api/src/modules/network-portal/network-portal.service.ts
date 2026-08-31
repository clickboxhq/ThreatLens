import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionAccessService } from '../session-core/session-access.service';
import { toStudentNetworkEventDto } from '../../common/dto/device.dto';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import type { NetworkDirection, Prisma } from '@prisma/client';

export interface NetworkListFilters {
  direction?: string;
  remoteIp?: string;
}

const VALID_DIRECTIONS = new Set<string>(['inbound', 'outbound']);

// Network Center: the session-wide view device-portal never had. NetworkEvent telemetry has
// existed since the endpoint domain shipped, but the only way to see it was per-device (§10's
// device-portal.getNetwork) — there was no way to see, say, every connection to one external IP
// across every host in the investigation at once, which is exactly the shape a real beaconing
// or lateral-movement finding takes. This mirrors device-portal's own access-check-then-query
// shape rather than introducing a new pattern.
@Injectable()
export class NetworkPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionAccess: SessionAccessService,
  ) {}

  async list(
    sessionId: string,
    user: AuthenticatedUser,
    filters: NetworkListFilters,
  ) {
    await this.sessionAccess.getOwnedSession(sessionId, user);

    const where: Prisma.NetworkEventWhereInput = { sessionId };
    // Ignore anything that isn't a real NetworkDirection value rather than letting an
    // unrecognized query param either 500 against Prisma's enum column or silently no-op.
    if (filters.direction && VALID_DIRECTIONS.has(filters.direction)) {
      where.direction = filters.direction as NetworkDirection;
    }
    if (filters.remoteIp) {
      where.remoteIp = { equals: filters.remoteIp, mode: 'insensitive' };
    }

    const events = await this.prisma.networkEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
    });
    return events.map(toStudentNetworkEventDto);
  }
}
