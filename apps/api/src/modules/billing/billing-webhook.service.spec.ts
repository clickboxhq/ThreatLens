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

  return { service: new BillingWebhookService(prisma), stores: s, tx };
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
