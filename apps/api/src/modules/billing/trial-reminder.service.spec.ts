import { TrialReminderService } from './trial-reminder.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ConfigService } from '@nestjs/config';
import type { EmailService } from '../../common/email/email.service';

interface Row {
  id: string;
  status: string;
  planId: string;
  trialEndsAt: Date | null;
  trialReminderSentAt: Date | null;
  user: { email: string; displayName: string } | null;
}

const inDays = (n: number) => new Date(Date.now() + n * 86400000);

function build(rows: Row[]) {
  const send = jest.fn<Promise<void>, [{ to: string; subject: string }]>(
    async () => undefined,
  );

  const prisma = {
    subscription: {
      findMany: jest.fn(async ({ where }: { where: Record<string, never> }) => {
        void where;
        // The service's own filter is exercised separately; this returns what Postgres
        // would for the documented query so the claim logic is what is under test.
        const cutoff = inDays(2);
        return rows.filter(
          (r) =>
            r.status === 'trialing' &&
            r.trialReminderSentAt === null &&
            r.trialEndsAt !== null &&
            r.trialEndsAt <= cutoff &&
            r.trialEndsAt > new Date(),
        );
      }),
      updateMany: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; trialReminderSentAt: null };
          data: { trialReminderSentAt: Date };
        }) => {
          const row = rows.find((r) => r.id === where.id);
          if (!row || row.trialReminderSentAt !== null) return { count: 0 };
          row.trialReminderSentAt = data.trialReminderSentAt;
          return { count: 1 };
        },
      ),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { trialReminderSentAt: null };
        }) => {
          const row = rows.find((r) => r.id === where.id)!;
          row.trialReminderSentAt = data.trialReminderSentAt;
          return row;
        },
      ),
    },
  } as unknown as PrismaService;

  const config = {
    get: () => 'https://threatlensapp.com',
  } as unknown as ConfigService;

  return {
    service: new TrialReminderService(
      prisma,
      { send } as unknown as EmailService,
      config,
    ),
    send,
    rows,
  };
}

const trialRow = (over: Partial<Row> = {}): Row => ({
  id: 'sub-1',
  status: 'trialing',
  planId: 'individual',
  trialEndsAt: inDays(1),
  trialReminderSentAt: null,
  user: { email: 'dana@example.com', displayName: 'Dana Okoro' },
  ...over,
});

describe('TrialReminderService', () => {
  it('warns before the charge, naming the amount and the date', async () => {
    const { service, send } = build([trialRow()]);

    expect(await service.run()).toBe(1);

    const sent = send.mock.calls[0][0] as unknown as {
      to: string;
      subject: string;
      text: string;
    };
    expect(sent.to).toBe('dana@example.com');
    expect(sent.subject).toContain('trial ends');
    // The two facts that decide whether somebody disputes the charge.
    expect(sent.text).toContain('₦10,000');
    expect(sent.text).toMatch(/cancel/i);
  });

  it('sends once, however often the loop runs', async () => {
    const { service, send } = build([trialRow()]);

    await service.run();
    await service.run();
    await service.run();

    expect(send).toHaveBeenCalledTimes(1);
  });

  // If the API runs more than one replica, every replica runs this loop against the same
  // rows. Claiming after sending would email the person once per replica.
  it('claims the row before sending, so two replicas cannot both email', async () => {
    const rows = [trialRow()];
    const a = build(rows);
    const b = build(rows);

    await Promise.all([a.service.run(), b.service.run()]);

    expect(a.send.mock.calls.length + b.send.mock.calls.length).toBe(1);
  });

  it('releases the claim when sending fails, so the next pass retries', async () => {
    // A warning that arrives late still beats charging somebody who was never told.
    const { service, send, rows } = build([trialRow()]);
    send.mockRejectedValueOnce(new Error('provider down'));

    expect(await service.run()).toBe(0);
    expect(rows[0].trialReminderSentAt).toBeNull();

    expect(await service.run()).toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('leaves alone a trial that is not close to ending', async () => {
    const { service, send } = build([trialRow({ trialEndsAt: inDays(6) })]);

    expect(await service.run()).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('does not warn an account that is already paying', async () => {
    const { service, send } = build([trialRow({ status: 'active' })]);

    expect(await service.run()).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('uses the organisation price for an organisation trial', async () => {
    const { service, send } = build([trialRow({ planId: 'organization' })]);

    await service.run();

    const sent = send.mock.calls[0][0] as unknown as { text: string };
    expect(sent.text).toContain('₦15,000');
  });
});
