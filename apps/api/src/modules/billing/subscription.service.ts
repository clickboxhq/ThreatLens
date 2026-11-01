import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

export interface Entitlement {
  /** The single question every caller actually asks. */
  active: boolean;
  planId: string | null;
  interval: string | null;
  status: string | null;
  currentPeriodEnd: string | null;
  /** Billed to an organisation rather than to the person. */
  viaOrganization: boolean;
}

const NONE: Entitlement = {
  active: false,
  planId: null,
  interval: null,
  status: null,
  currentPeriodEnd: null,
  viaOrganization: false,
};

/**
 * Decides whether someone has paid access.
 *
 * Access is granted by one thing only: a period end in the future. Status is descriptive —
 * a `past_due` subscription whose paid period has not yet run out still works, and a
 * `cancelled` one does too until the time already bought is used up. Gating on status
 * instead would cut people off from a month they paid for the moment a renewal failed.
 */
@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * One query, not three.
   *
   * SubscriptionGuard calls this on nearly every request now that there is no free tier, so
   * its cost is paid on every page a customer loads. The obvious shape — look up your own
   * subscription, then your organisation, then its subscription — is three round trips for
   * anyone whose personal subscription is absent, which is every member of a paying
   * organisation. Prisma can fetch all of it in one.
   */
  async describeFor(user: AuthenticatedUser): Promise<Entitlement> {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        subscription: true,
        organization: { select: { subscription: true } },
      },
    });

    const mine = this.toEntitlement(row?.subscription ?? null, false);
    if (mine.active) return mine;

    // An organisation's subscription covers its members, so a personal one that has lapsed
    // does not mean no access.
    const viaOrg = this.toEntitlement(
      row?.organization?.subscription ?? null,
      true,
    );
    return viaOrg.active ? viaOrg : mine;
  }

  async hasActiveAccess(user: AuthenticatedUser): Promise<boolean> {
    return (await this.describeFor(user)).active;
  }

  private toEntitlement(
    sub: {
      planId: string;
      interval: string;
      status: string;
      currentPeriodEnd: Date;
    } | null,
    viaOrganization: boolean,
  ): Entitlement {
    if (!sub) return { ...NONE, viaOrganization };
    return {
      active: sub.currentPeriodEnd > new Date() && sub.status !== 'expired',
      planId: sub.planId,
      interval: sub.interval,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      viaOrganization,
    };
  }
}
