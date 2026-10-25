import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaystackClient } from './paystack.client';

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
    authorization?: { authorization_code?: string; reusable?: boolean };
    customer?: { customer_code?: string; email?: string };
    metadata?: {
      userId?: string;
      orgId?: string;
      planId?: string;
      interval?: string;
      /** Set on the small charge that exists only to capture a card for a trial. */
      kind?: string;
      trialDays?: number | string;
    };
  };
}

const MONTH_DAYS = 30;
const YEAR_DAYS = 365;
const CARD_VERIFICATION = 'card_verification';

@Injectable()
export class BillingWebhookService {
  private readonly logger = new Logger(BillingWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackClient,
  ) {}

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

    if (meta.kind === CARD_VERIFICATION) {
      return this.onCardCaptured(event, reference, userId, orgId);
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

  /**
   * The card-upfront trial: a small charge captured a card, so start the free period and
   * schedule the real charge for the day it ends.
   *
   * Deliberately resumable rather than merely idempotent. The database writes commit before
   * the two calls back out to Paystack, so a failure in between would otherwise leave
   * somebody on a trial that never converts — free forever, silently. On a redelivery this
   * picks up from whichever step has not happened yet instead of returning early because the
   * payment row already exists.
   */
  private async onCardCaptured(
    event: PaystackEvent,
    reference: string,
    userId: string | null,
    orgId: string | null,
  ): Promise<void> {
    const d = event.data ?? {};
    const meta = d.metadata ?? {};
    const authorizationCode = d.authorization?.authorization_code ?? null;
    const customerCode = d.customer?.customer_code ?? null;
    const trialDays = Number(meta.trialDays ?? 7) || 7;
    const planId = meta.planId ?? (orgId ? 'organization' : 'individual');

    if (!authorizationCode || !customerCode) {
      throw new Error(
        `card verification ${reference} returned no reusable authorisation`,
      );
    }

    const where = userId ? { userId } : { orgId: orgId as string };

    const subscription = await this.prisma.$transaction(async (tx) => {
      const existingPayment = await tx.payment.findUnique({
        where: { reference },
      });
      if (!existingPayment) {
        await tx.payment.create({
          data: {
            userId,
            orgId,
            reference,
            kind: 'card_verification',
            amountKobo: d.amount ?? 0,
            currency: d.currency ?? 'NGN',
            status: 'success',
            paidAt: new Date(d.paid_at ?? d.paidAt ?? Date.now()),
            raw: (event as unknown as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          },
        });
      }

      const current = await tx.subscription.findFirst({ where });
      const trialEndsAt = new Date(Date.now() + trialDays * 86400000);

      if (current) {
        return tx.subscription.update({
          where: { id: current.id },
          data: {
            paystackAuthorizationCode: authorizationCode,
            paystackCustomerCode: customerCode,
          },
        });
      }
      return tx.subscription.create({
        data: {
          userId,
          orgId,
          planId,
          interval: 'monthly',
          status: 'trialing',
          trialEndsAt,
          // Access during the trial is the same mechanism as access when paid: a period
          // end in the future. Nothing downstream needs to know a trial is special.
          currentPeriodEnd: trialEndsAt,
          paystackAuthorizationCode: authorizationCode,
          paystackCustomerCode: customerCode,
        },
      });
    });

    if (!subscription.paystackSubscriptionCode) {
      const planCode = this.planCodeFor(planId);
      if (!planCode) {
        throw new Error(
          `no Paystack plan code for ${planId}; trial would never convert`,
        );
      }
      const created = await this.paystack.createSubscription({
        customerCode,
        planCode,
        authorizationCode,
        startDate: subscription.trialEndsAt ?? subscription.currentPeriodEnd,
      });
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          paystackSubscriptionCode: created.subscriptionCode,
          paystackEmailToken: created.emailToken,
          paystackPlanCode: planCode,
        },
      });
    }

    // Best effort, and last. The card is captured and the charge is scheduled; failing the
    // whole delivery over an unreturned fifty naira would risk re-running everything above.
    try {
      await this.paystack.refund(reference);
      await this.prisma.payment.update({
        where: { reference },
        data: { status: 'refunded' },
      });
    } catch (err) {
      this.logger.error(
        `Card-verification refund for ${reference} failed, refund it by hand: ${(err as Error).message}`,
      );
    }
  }

  private planCodeFor(planId: string): string | null {
    return planId === 'organization'
      ? (process.env.PAYSTACK_PLAN_ORGANIZATION_MONTHLY ?? null)
      : (process.env.PAYSTACK_PLAN_INDIVIDUAL_MONTHLY ?? null);
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
