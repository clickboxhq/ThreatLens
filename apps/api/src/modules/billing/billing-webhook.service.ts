import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** The shape we rely on. Paystack sends a great deal more; none of it is trusted. */
interface PaystackEvent {
  event?: string;
  data?: {
    reference?: string;
    amount?: number;
    currency?: string;
    status?: string;
    paid_at?: string;
    paidAt?: string;
    subscription_code?: string;
    plan?: { plan_code?: string };
    customer?: { customer_code?: string; email?: string };
    metadata?: {
      userId?: string;
      orgId?: string;
      planId?: string;
      interval?: string;
    };
  };
}

const MONTH_DAYS = 30;
const YEAR_DAYS = 365;

@Injectable()
export class BillingWebhookService {
  private readonly logger = new Logger(BillingWebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records the delivery, then acts on it at most once.
   *
   * Paystack retries anything it did not get a prompt 200 for, so the same event arrives
   * repeatedly as a matter of course. The dedupe key is a digest of the exact bytes
   * delivered, which makes a retry a no-op without needing the provider to supply a stable
   * event id — it does not.
   *
   * A delivery that was stored but failed to process is retried on redelivery rather than
   * skipped: skipping on the presence of the row alone would turn one transient database
   * error into a payment that is never credited.
   */
  async receive(
    rawBody: Buffer,
    parsed: unknown,
  ): Promise<'processed' | 'duplicate'> {
    const event = (parsed ?? {}) as PaystackEvent;
    const eventType = event.event ?? 'unknown';
    const dedupeKey = createHash('sha256').update(rawBody).digest('hex');

    const existing = await this.prisma.webhookEvent.findUnique({
      where: { dedupeKey },
    });
    if (existing?.processedAt) return 'duplicate';

    const row =
      existing ??
      (await this.prisma.webhookEvent.create({
        data: {
          dedupeKey,
          eventType,
          payload: (parsed ?? {}) as Prisma.InputJsonValue,
        },
      }));

    try {
      await this.handle(eventType, event);
      await this.prisma.webhookEvent.update({
        where: { id: row.id },
        data: { processedAt: new Date(), error: null },
      });
      return 'processed';
    } catch (err) {
      const message = (err as Error).message.slice(0, 500);
      this.logger.error(`Handling ${eventType} failed: ${message}`);
      await this.prisma.webhookEvent.update({
        where: { id: row.id },
        data: { error: message },
      });
      // Swallowed on purpose: the delivery is durably recorded, so the caller still answers
      // 200 and Paystack stops retrying. The row carries the error for replay.
      return 'processed';
    }
  }

  private async handle(eventType: string, event: PaystackEvent): Promise<void> {
    switch (eventType) {
      case 'charge.success':
        return this.onChargeSuccess(event);
      case 'subscription.create':
        return this.onSubscriptionCreate(event);
      case 'subscription.disable':
      case 'subscription.not_renew':
        return this.onSubscriptionEnding(event);
      case 'invoice.payment_failed':
        return this.onPaymentFailed(event);
      default:
        this.logger.log(`Ignoring unhandled Paystack event: ${eventType}`);
    }
  }

  /**
   * The only path that credits money and extends access.
   *
   * The period is extended from whichever is later: now, or the end already paid for. A
   * renewal that arrives before the current period expires must add to it rather than
   * truncate it, which is what extending from `now` alone would do.
   */
  private async onChargeSuccess(event: PaystackEvent): Promise<void> {
    const d = event.data ?? {};
    const reference = d.reference;
    if (!reference) throw new Error('charge.success with no reference');

    const meta = d.metadata ?? {};
    const userId = meta.userId ?? null;
    const orgId = meta.orgId ?? null;
    if (!userId && !orgId) {
      throw new Error(
        `charge.success ${reference} carries no customer in metadata`,
      );
    }

    const interval = meta.interval === 'annual' ? 'annual' : 'monthly';
    const days = interval === 'annual' ? YEAR_DAYS : MONTH_DAYS;
    const paidAt = d.paid_at ?? d.paidAt ?? null;

    await this.prisma.$transaction(async (tx) => {
      // The unique reference is the second line of defence: even with the dedupe row lost,
      // the same transaction cannot be credited twice.
      const already = await tx.payment.findUnique({ where: { reference } });
      if (already) return;

      const where = userId ? { userId } : { orgId: orgId as string };
      const current = await tx.subscription.findFirst({ where });

      const base =
        current && current.currentPeriodEnd > new Date()
          ? current.currentPeriodEnd
          : new Date();
      const currentPeriodEnd = new Date(base.getTime() + days * 86400000);

      const subscription = current
        ? await tx.subscription.update({
            where: { id: current.id },
            data: {
              status: 'active',
              currentPeriodEnd,
              cancelledAt: null,
              paystackCustomerCode:
                d.customer?.customer_code ?? current.paystackCustomerCode,
            },
          })
        : await tx.subscription.create({
            data: {
              userId,
              orgId,
              planId: meta.planId ?? (orgId ? 'organization' : 'individual'),
              interval,
              status: 'active',
              currentPeriodEnd,
              paystackCustomerCode: d.customer?.customer_code ?? null,
              paystackPlanCode: d.plan?.plan_code ?? null,
            },
          });

      await tx.payment.create({
        data: {
          subscriptionId: subscription.id,
          userId,
          orgId,
          reference,
          amountKobo: d.amount ?? 0,
          currency: d.currency ?? 'NGN',
          status: 'success',
          paidAt: paidAt ? new Date(paidAt) : new Date(),
          raw: (event as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });
    });
  }

  /** Links Paystack's subscription code so a later cancellation can be matched to a row. */
  private async onSubscriptionCreate(event: PaystackEvent): Promise<void> {
    const d = event.data ?? {};
    const code = d.subscription_code;
    const customerCode = d.customer?.customer_code;
    if (!code || !customerCode) return;

    await this.prisma.subscription.updateMany({
      where: { paystackCustomerCode: customerCode },
      data: {
        paystackSubscriptionCode: code,
        paystackPlanCode: d.plan?.plan_code ?? null,
      },
    });
  }

  /**
   * Cancelled, not cut off. Access runs to the end of the period already paid for — ending
   * it the moment someone cancels would be taking money for time not given.
   */
  private async onSubscriptionEnding(event: PaystackEvent): Promise<void> {
    const code = event.data?.subscription_code;
    if (!code) return;

    await this.prisma.subscription.updateMany({
      where: { paystackSubscriptionCode: code },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });
  }

  /**
   * A failed renewal marks the subscription past_due and changes nothing else. Access still
   * runs to `currentPeriodEnd`, so a card that fails on the 1st does not lock someone out of
   * a month they already paid for; it simply will not extend.
   */
  private async onPaymentFailed(event: PaystackEvent): Promise<void> {
    const code = event.data?.subscription_code;
    if (!code) return;

    await this.prisma.subscription.updateMany({
      where: { paystackSubscriptionCode: code, status: 'active' },
      data: { status: 'past_due' },
    });
  }
}
