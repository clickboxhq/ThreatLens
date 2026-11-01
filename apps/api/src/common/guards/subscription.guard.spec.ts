import { SubscriptionGuard } from './subscription.guard';
import { NO_SUBSCRIPTION_REQUIRED } from '../decorators/no-subscription-required.decorator';
import type { Reflector } from '@nestjs/core';
import type { SubscriptionService } from '../../modules/billing/subscription.service';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from './jwt-auth.guard';

function build(opts: {
  active: boolean;
  exempt?: boolean;
  /** null means this account has never had a subscription at all. */
  status?: string | null;
}) {
  const describeFor = jest.fn(async () => ({
    active: opts.active,
    planId: null,
    interval: null,
    status: opts.status ?? null,
    currentPeriodEnd: null,
    viaOrganization: false,
  }));
  const subscriptions = { describeFor } as unknown as SubscriptionService;
  const reflector = {
    getAllAndOverride: jest.fn((key: string) =>
      key === NO_SUBSCRIPTION_REQUIRED ? opts.exempt : undefined,
    ),
  } as unknown as Reflector;
  return {
    guard: new SubscriptionGuard(subscriptions, reflector),
    describeFor,
  };
}

const ctx = (user?: Partial<AuthenticatedUser>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        user: user
          ? ({ id: 'u1', role: 'student', ...user } as AuthenticatedUser)
          : undefined,
      }),
    }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  }) as unknown as ExecutionContext;

/**
 * ThreatLens has no free tier, so this guard is the paywall. Its failure modes are
 * asymmetric: letting somebody through who has not paid costs a subscription, but wrongly
 * blocking somebody costs a customer — and the worst case is blocking them from the page
 * where they would have paid.
 */
describe('SubscriptionGuard', () => {
  it('allows an account with active access', async () => {
    const { guard } = build({ active: true });
    await expect(guard.canActivate(ctx({}))).resolves.toBe(true);
  });

  it('refuses an account without it, with a status that says why', async () => {
    const { guard } = build({ active: false });
    await expect(guard.canActivate(ctx({}))).rejects.toMatchObject({
      status: 402,
      code: 'SUBSCRIPTION_REQUIRED',
    });
  });

  // Staff, not customers. An operator locked out of the admin panel by a billing state is an
  // operator who cannot fix the billing state.
  it('never blocks a platform admin, whatever their billing', async () => {
    const { guard, describeFor } = build({ active: false });
    await expect(
      guard.canActivate(ctx({ role: 'platform_admin' })),
    ).resolves.toBe(true);
    expect(describeFor).not.toHaveBeenCalled();
  });

  it('blocks an org admin whose organisation is not paying', async () => {
    // An org admin is a customer. They can still reach billing, which is not gated.
    const { guard } = build({ active: false });
    await expect(
      guard.canActivate(ctx({ role: 'org_admin' })),
    ).rejects.toMatchObject({ status: 402 });
  });

  it('lets an explicitly exempted route through', async () => {
    const { guard, describeFor } = build({ active: false, exempt: true });
    await expect(guard.canActivate(ctx({}))).resolves.toBe(true);
    expect(describeFor).not.toHaveBeenCalled();
  });

  it('defers to authentication when there is no caller', async () => {
    // Deciding entitlement for nobody is not this guard's job; JwtAuthGuard rejects first.
    const { guard } = build({ active: false });
    await expect(guard.canActivate(ctx(undefined))).resolves.toBe(true);
  });
  // The refusal is read by someone deciding whether to pay, so it has to describe their
  // actual situation. A new account has no trial to have ended.
  it('offers the trial to an account that has never subscribed', async () => {
    const { guard } = build({ active: false, status: null });
    await expect(guard.canActivate(ctx({}))).rejects.toMatchObject({
      message: expect.stringContaining('Start your free trial'),
    });
  });

  it('asks a lapsed account to renew rather than offering a fresh trial', async () => {
    const { guard } = build({ active: false, status: 'expired' });
    const err = await guard.canActivate(ctx({})).catch((e: Error) => e);
    expect((err as Error).message).toContain('Renew');
    expect((err as Error).message).not.toContain('free trial');
  });
});
