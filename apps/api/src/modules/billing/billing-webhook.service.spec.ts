import { BillingWebhookService } from './billing-webhook.service';
import type { PrismaService } from '../../prisma/prisma.service';

interface Stores {
  events: Array<{
    id: string;
    dedupeKey: string;
    processedAt: Date | null;
    error: string | null;
  }>;
  payments: Array<{
    reference: string;
    amountKobo: number;
    userId: string | null;
  }>;
  subscriptions: Array<{
    id: string;
    userId: string | null;
    orgId: string | null;
    planId: string;
    interval: string;
    status: string;
    currentPeriodEnd: Date;
    paystackCustomerCode: string | null;
    paystackSubscriptionCode: string | null;
    cancelledAt: Date | null;
  }>;
}

function build(seed: Partial<Stores> = {}) {
  const s: Stores = {
    events: seed.events ?? [],
    payments: seed.payments ?? [],
    subscriptions: seed.subscriptions ?? [],
  };
  let n = 0;
  const id = () => `id-${++n}`;

  const tx = {
    payment: {
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { reference: string };
          data: Record<string, unknown>;
        }) => {
          const row = s.payments.find((x) => x.reference === where.reference);
          if (row) Object.assign(row, data);
          return row;
        },
      ),
      findUnique: jest.fn(
        async ({ where }: { where: { reference: string } }) =>
          s.payments.find((p) => p.reference === where.reference) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        s.payments.push(data as never);
        return data;
      }),
    },
    subscription: {
      findFirst: jest.fn(
        async ({ where }: { where: Record<string, string> }) =>
          s.subscriptions.find(
            (x) =>
              (where.userId !== undefined && x.userId === where.userId) ||
              (where.orgId !== undefined && x.orgId === where.orgId),
          ) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: id(), ...data } as never;
        s.subscriptions.push(row);
        return row;
      }),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = s.subscriptions.find((x) => x.id === where.id)!;
          Object.assign(row, data);
          return row;
        },
      ),
    },
  };

  const prisma = {
    payment: {
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { reference: string };
          data: Record<string, unknown>;
        }) => {
          const row = s.payments.find((x) => x.reference === where.reference);
          if (row) Object.assign(row, data);
          return row;
        },
      ),
    },
    webhookEvent: {
      findUnique: jest.fn(
        async ({ where }: { where: { dedupeKey: string } }) =>
          s.events.find((e) => e.dedupeKey === where.dedupeKey) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: { dedupeKey: string } }) => {
        const row = { id: id(), processedAt: null, error: null, ...data };
        s.events.push(row as never);
        return row;
      }),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = s.events.find((e) => e.id === where.id)!;
          Object.assign(row, data);
          return row;
        },
      ),
    },
    subscription: {
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = s.subscriptions.find((x) => x.id === where.id)!;
          Object.assign(row, data);
          return row;
        },
      ),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, string>;
          data: Record<string, unknown>;
        }) => {
          let count = 0;
          for (const row of s.subscriptions) {
            const matches = Object.entries(where).every(
              ([k, v]) => (row as unknown as Record<string, unknown>)[k] === v,
            );
            if (matches) {
              Object.assign(row, data);
              count += 1;
            }
          }
          return { count };
        },
      ),
    },
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  } as unknown as PrismaService;

  const paystack = {
    createSubscription: jest.fn<
      Promise<{ subscriptionCode: string; emailToken: string }>,
      [
        {
          customerCode: string;
          planCode: string;
          authorizationCode: string;
          startDate: Date;
        },
      ]
    >(async () => ({ subscriptionCode: 'SUB_NEW', emailToken: 'TOK' })),
    refund: jest.fn<Promise<void>, [string]>(async () => undefined),
    disableSubscription: jest.fn(async () => undefined),
  };

  return {
    service: new BillingWebhookService(prisma, paystack as never),
    stores: s,
    tx,
    paystack,
  };
}

const chargeBody = (
  reference: string,
  amountKobo = 1_000_000,
  userId = 'user-1',
) => {
  const payload = {
    event: 'charge.success',
    data: {
      reference,
      amount: amountKobo,
      currency: 'NGN',
      paid_at: '2026-10-22T10:00:00.000Z',
      customer: { customer_code: 'CUS_1', email: 'a@example.com' },
      metadata: { userId, planId: 'individual', interval: 'monthly' },
    },
  };
  return { raw: Buffer.from(JSON.stringify(payload)), payload };
};

describe('BillingWebhookService', () => {
  it('credits a successful charge and grants a period', async () => {
    const { service, stores } = build();
    const { raw, payload } = chargeBody('tl_a');

    await service.receive(raw, payload);

    expect(stores.payments).toHaveLength(1);
    expect(stores.payments[0].amountKobo).toBe(1_000_000);
    expect(stores.subscriptions).toHaveLength(1);
    expect(stores.subscriptions[0].currentPeriodEnd.getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  // Paystack retries anything it did not get a prompt 200 for, so this is the normal case,
  // not an edge one.
  it('ignores a redelivery of the same event', async () => {
    const { service, stores } = build();
    const { raw, payload } = chargeBody('tl_a');

    await service.receive(raw, payload);
    const second = await service.receive(raw, payload);

    expect(second).toBe('duplicate');
    expect(stores.payments).toHaveLength(1);
  });

  // Belt and braces: even if the dedupe row were lost, the unique reference must stop the
  // same transaction being credited twice.
  it('does not credit the same reference twice even on a different delivery', async () => {
    const { service, stores } = build();
    const first = chargeBody('tl_a');
    await service.receive(first.raw, first.payload);

    // Same reference, different bytes — so a different dedupe key.
    const resent = {
      ...first.payload,
      data: { ...first.payload.data, currency: 'NGN ' },
    };
    await service.receive(Buffer.from(JSON.stringify(resent)), resent);

    expect(stores.payments).toHaveLength(1);
  });

  it('extends from the existing period end, not from today', async () => {
    // A renewal arriving before expiry must add to the time already bought.
    const future = new Date(Date.now() + 10 * 86400000);
    const { service, stores } = build({
      subscriptions: [
        {
          id: 'sub-1',
          userId: 'user-1',
          orgId: null,
          planId: 'individual',
          interval: 'monthly',
          status: 'active',
          currentPeriodEnd: future,
          paystackCustomerCode: 'CUS_1',
          paystackSubscriptionCode: null,
          cancelledAt: null,
        },
      ],
    });

    const { raw, payload } = chargeBody('tl_b');
    await service.receive(raw, payload);

    const end = stores.subscriptions[0].currentPeriodEnd.getTime();
    expect(end).toBeGreaterThan(future.getTime() + 29 * 86400000);
  });

  it('records the failure and still answers, so one bad event is not lost', async () => {
    const { service, stores } = build();
    // No customer in metadata: the handler throws.
    const payload = {
      event: 'charge.success',
      data: { reference: 'tl_c', amount: 1000, metadata: {} },
    };

    const result = await service.receive(
      Buffer.from(JSON.stringify(payload)),
      payload,
    );

    expect(result).toBe('processed');
    expect(stores.payments).toHaveLength(0);
    expect(stores.events[0].error).toContain('no customer');
    expect(stores.events[0].processedAt).toBeNull();
  });

  it('retries a previously failed delivery rather than skipping it', async () => {
    // A transient failure followed by a redelivery must credit the payment, not be swallowed
    // as a duplicate.
    const { service, stores } = build();
    const broken = {
      event: 'charge.success',
      data: { reference: 'tl_d', amount: 1000, metadata: {} },
    };
    const raw = Buffer.from(JSON.stringify(broken));
    await service.receive(raw, broken);
    expect(stores.events[0].processedAt).toBeNull();

    // Same bytes, but now the handler can succeed.
    const fixed = {
      ...broken,
      data: { ...broken.data, metadata: { userId: 'user-1' } },
    };
    await service.receive(raw, fixed);

    expect(stores.payments).toHaveLength(1);
    expect(stores.events).toHaveLength(1);
    expect(stores.events[0].processedAt).not.toBeNull();
  });

  it('marks a cancelled subscription without ending access', async () => {
    const end = new Date(Date.now() + 20 * 86400000);
    const { service, stores } = build({
      subscriptions: [
        {
          id: 'sub-1',
          userId: 'user-1',
          orgId: null,
          planId: 'individual',
          interval: 'monthly',
          status: 'active',
          currentPeriodEnd: end,
          paystackCustomerCode: 'CUS_1',
          paystackSubscriptionCode: 'SUB_1',
          cancelledAt: null,
        },
      ],
    });

    const payload = {
      event: 'subscription.disable',
      data: { subscription_code: 'SUB_1' },
    };
    await service.receive(Buffer.from(JSON.stringify(payload)), payload);

    expect(stores.subscriptions[0].status).toBe('cancelled');
    expect(stores.subscriptions[0].currentPeriodEnd).toEqual(end);
  });

  it('passes over an event it does not handle', async () => {
    const { service, stores } = build();
    const payload = { event: 'customer.identification.failed', data: {} };

    const result = await service.receive(
      Buffer.from(JSON.stringify(payload)),
      payload,
    );

    expect(result).toBe('processed');
    expect(stores.events[0].error).toBeNull();
  });
});

const verificationBody = (reference: string, userId = 'user-1') => {
  const payload = {
    event: 'charge.success',
    data: {
      reference,
      amount: 5000,
      currency: 'NGN',
      paid_at: '2026-10-25T10:00:00.000Z',
      customer: { customer_code: 'CUS_1', email: 'a@example.com' },
      authorization: { authorization_code: 'AUTH_1', reusable: true },
      metadata: {
        userId,
        planId: 'individual',
        interval: 'monthly',
        kind: 'card_verification',
        trialDays: 7,
      },
    },
  };
  return { raw: Buffer.from(JSON.stringify(payload)), payload };
};

/**
 * The card-upfront trial. Everything here is about the gap between capturing a card and
 * charging it a week later — the window in which a mistake is either a free ride forever or
 * a charge somebody did not agree to.
 */
describe('BillingWebhookService — card-upfront trial', () => {
  beforeAll(() => {
    process.env.PAYSTACK_PLAN_INDIVIDUAL_MONTHLY = 'PLN_test';
  });

  it('starts a trial and schedules the first real charge for the day it ends', async () => {
    const { service, stores, paystack } = build();
    const { raw, payload } = verificationBody('tl_v1');

    await service.receive(raw, payload);

    const sub = stores.subscriptions[0];
    expect(sub.status).toBe('trialing');
    expect(paystack.createSubscription).toHaveBeenCalledTimes(1);

    const scheduled = paystack.createSubscription.mock.calls[0][0] as {
      startDate: Date;
      planCode: string;
      authorizationCode: string;
    };
    expect(scheduled.planCode).toBe('PLN_test');
    expect(scheduled.authorizationCode).toBe('AUTH_1');
    // Charged when the free week ends, not before.
    const days = (scheduled.startDate.getTime() - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it('gives access for the trial week', async () => {
    const { service, stores } = build();
    const { raw, payload } = verificationBody('tl_v2');

    await service.receive(raw, payload);

    const sub = stores.subscriptions[0];
    expect(sub.currentPeriodEnd.getTime()).toBeGreaterThan(Date.now());
    const days = (sub.currentPeriodEnd.getTime() - Date.now()) / 86400000;
    expect(days).toBeLessThan(7.1);
  });

  it('refunds the card-verification charge and does not count it as revenue', async () => {
    const { service, stores, paystack } = build();
    const { raw, payload } = verificationBody('tl_v3');

    await service.receive(raw, payload);

    expect(paystack.refund).toHaveBeenCalledWith('tl_v3');
    const payment = stores.payments[0] as unknown as Record<string, unknown>;
    expect(payment.kind).toBe('card_verification');
    expect(payment.status).toBe('refunded');
  });

  it('refuses a capture that produced no reusable card', async () => {
    // Without an authorisation there is nothing to charge later, so starting the free week
    // would be giving the product away with no way to convert.
    const { service, stores, paystack } = build();
    const payload = {
      event: 'charge.success',
      data: {
        reference: 'tl_v4',
        amount: 5000,
        customer: { customer_code: 'CUS_1' },
        metadata: { userId: 'user-1', kind: 'card_verification' },
      },
    };

    await service.receive(Buffer.from(JSON.stringify(payload)), payload);

    expect(stores.subscriptions).toHaveLength(0);
    expect(paystack.createSubscription).not.toHaveBeenCalled();
    expect(stores.events[0].error).toContain('reusable authorisation');
  });

  it('resumes scheduling on redelivery when the provider call failed', async () => {
    // The database writes commit before the call to Paystack. A failure in between would
    // otherwise leave someone on a trial that never converts — free forever, silently.
    const { service, stores, paystack } = build();
    paystack.createSubscription.mockRejectedValueOnce(
      new Error('provider down'),
    );

    const { raw, payload } = verificationBody('tl_v5');
    await service.receive(raw, payload);

    expect(stores.subscriptions[0].paystackSubscriptionCode).toBeUndefined();
    expect(stores.events[0].processedAt).toBeNull();

    await service.receive(raw, payload);

    expect(paystack.createSubscription).toHaveBeenCalledTimes(2);
    expect(stores.subscriptions[0].paystackSubscriptionCode).toBe('SUB_NEW');
    expect(stores.payments).toHaveLength(1);
  });

  it('still completes the trial when the refund fails', async () => {
    // Fifty naira unreturned must not fail the delivery and re-run the scheduling above.
    const { service, stores, paystack } = build();
    paystack.refund.mockRejectedValueOnce(new Error('refund refused'));

    const { raw, payload } = verificationBody('tl_v6');
    await service.receive(raw, payload);

    expect(stores.subscriptions[0].status).toBe('trialing');
    expect(stores.events[0].processedAt).not.toBeNull();
  });

  it('converts the trial to a paid month when the scheduled charge lands', async () => {
    const { service, stores } = build();
    const first = verificationBody('tl_v7');
    await service.receive(first.raw, first.payload);
    expect(stores.subscriptions[0].status).toBe('trialing');

    // Seven days later Paystack charges the real amount — an ordinary charge, no kind.
    const charge = {
      event: 'charge.success',
      data: {
        reference: 'tl_real',
        amount: 1_000_000,
        currency: 'NGN',
        paid_at: '2026-11-01T10:00:00.000Z',
        customer: { customer_code: 'CUS_1' },
        metadata: {
          userId: 'user-1',
          planId: 'individual',
          interval: 'monthly',
        },
      },
    };
    await service.receive(Buffer.from(JSON.stringify(charge)), charge);

    expect(stores.subscriptions[0].status).toBe('active');
    const days =
      (stores.subscriptions[0].currentPeriodEnd.getTime() - Date.now()) /
      86400000;
    expect(days).toBeGreaterThan(30);
  });
});
