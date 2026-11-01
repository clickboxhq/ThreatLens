import { SubscriptionService } from './subscription.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

const USER = {
  id: 'u1',
  role: 'student',
  orgId: null,
  sessionVersion: 1,
} as AuthenticatedUser;

const inDays = (n: number) => new Date(Date.now() + n * 86400000);

type Sub = {
  planId: string;
  interval: string;
  status: string;
  currentPeriodEnd: Date;
} | null;

function build(own: Sub, org: Sub = null) {
  const findUnique = jest.fn(async () => ({
    subscription: own,
    organization: org ? { subscription: org } : null,
  }));
  const prisma = { user: { findUnique } } as unknown as PrismaService;
  return { service: new SubscriptionService(prisma), findUnique };
}

const sub = (over: Partial<NonNullable<Sub>> = {}): NonNullable<Sub> => ({
  planId: 'individual',
  interval: 'monthly',
  status: 'active',
  currentPeriodEnd: inDays(10),
  ...over,
});

/**
 * This decides whether somebody can use the product at all, and it runs on nearly every
 * request. Both of its failure directions are expensive: letting a lapsed account through
 * gives the product away, and wrongly refusing a paying one locks out a customer who has
 * already been charged.
 */
describe('SubscriptionService.describeFor', () => {
  it('grants access on an active personal subscription', async () => {
    const { service } = build(sub());
    await expect(service.hasActiveAccess(USER)).resolves.toBe(true);
  });

  it('refuses an account with no subscription at all', async () => {
    const { service } = build(null);
    const e = await service.describeFor(USER);
    expect(e.active).toBe(false);
    expect(e.status).toBeNull();
  });

  it("grants access through an organisation's subscription", async () => {
    // The member has nothing of their own; their employer pays.
    const { service } = build(null, sub({ planId: 'organization' }));
    const e = await service.describeFor(USER);
    expect(e.active).toBe(true);
    expect(e.viaOrganization).toBe(true);
  });

  it('falls back to the organisation when the personal one has lapsed', async () => {
    const { service } = build(
      sub({ currentPeriodEnd: inDays(-1) }),
      sub({ planId: 'organization' }),
    );
    const e = await service.describeFor(USER);
    expect(e.active).toBe(true);
    expect(e.viaOrganization).toBe(true);
  });

  it('refuses when neither the person nor their organisation is paying', async () => {
    const { service } = build(
      sub({ currentPeriodEnd: inDays(-1) }),
      sub({ currentPeriodEnd: inDays(-5) }),
    );
    await expect(service.hasActiveAccess(USER)).resolves.toBe(false);
  });

  // Access is granted by a period end in the future, never by status. These three are the
  // cases where those two disagree, and getting them wrong takes away time already paid for.
  it('keeps a trial running until it ends', async () => {
    const { service } = build(sub({ status: 'trialing' }));
    await expect(service.hasActiveAccess(USER)).resolves.toBe(true);
  });

  it('keeps a cancelled subscription working to the end of the paid period', async () => {
    const { service } = build(sub({ status: 'cancelled' }));
    await expect(service.hasActiveAccess(USER)).resolves.toBe(true);
  });

  it('keeps a past-due subscription working to the end of the paid period', async () => {
    // A card that fails on the 2nd must not take away the month already bought.
    const { service } = build(sub({ status: 'past_due' }));
    await expect(service.hasActiveAccess(USER)).resolves.toBe(true);
  });

  it('refuses an expired subscription even with time left on the clock', async () => {
    const { service } = build(sub({ status: 'expired' }));
    await expect(service.hasActiveAccess(USER)).resolves.toBe(false);
  });

  // The guard runs this on nearly every request, so its cost is paid on every page load.
  it('asks the database exactly once', async () => {
    const { service, findUnique } = build(
      null,
      sub({ planId: 'organization' }),
    );
    await service.describeFor(USER);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});
