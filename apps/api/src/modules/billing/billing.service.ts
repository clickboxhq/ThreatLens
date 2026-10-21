import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaystackClient } from './paystack.client';
import type { CustomerRevenue, PlatformRevenueSummary } from './billing.types';

const NO_PROVIDER_REASON = 'no_payment_provider';
const CURRENCY = 'NGN';

/**
 * The billing seam, now reading a real ledger.
 *
 * Every figure here is net and confirmed: successful captured payments only, minus refunds,
 * taken from the `payments` table — which only the signed webhook handler writes. Nothing is
 * ever derived from a plan's list price or from a count of active subscriptions, because
 * both of those report money that was never collected.
 *
 * With no provider key configured the methods still answer "not available", so a deployment
 * without Paystack behaves exactly as it did before rather than showing zeroes that look
 * like a bad month.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackClient,
  ) {}

  isConfigured(): boolean {
    return this.paystack.isConfigured();
  }

  async getPlatformRevenueSummary(): Promise<PlatformRevenueSummary> {
    if (!this.isConfigured()) {
      return {
        available: false,
        reason: NO_PROVIDER_REASON,
        currency: CURRENCY,
        grossRevenueCents: 0,
        refundedCents: 0,
        netRevenueCents: 0,
        netRevenueThisMonthCents: 0,
        netRevenueThisYearCents: 0,
        payingCustomerCount: 0,
      };
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [gross, refunded, thisMonth, thisYear, payingUsers, payingOrgs] =
      await Promise.all([
        this.sum({ status: 'success' }),
        this.sum({ status: 'refunded' }),
        this.sum({ status: 'success', paidAt: { gte: monthStart } }),
        this.sum({ status: 'success', paidAt: { gte: yearStart } }),
        this.prisma.payment.findMany({
          where: { status: 'success', userId: { not: null } },
          distinct: ['userId'],
          select: { userId: true },
        }),
        this.prisma.payment.findMany({
          where: { status: 'success', orgId: { not: null } },
          distinct: ['orgId'],
          select: { orgId: true },
        }),
      ]);

    return {
      available: true,
      reason: null,
      currency: CURRENCY,
      grossRevenueCents: gross,
      refundedCents: refunded,
      netRevenueCents: gross - refunded,
      netRevenueThisMonthCents: thisMonth,
      netRevenueThisYearCents: thisYear,
      payingCustomerCount: payingUsers.length + payingOrgs.length,
    };
  }

  /**
   * Revenue keyed by billing-customer id — a user id for an individual, an organisation id
   * for an org. Ids with no confirmed payment are simply absent, which the admin list
   * renders as a dash rather than a zero.
   */
  async getRevenueByCustomer(
    customerIds: string[],
  ): Promise<Map<string, CustomerRevenue>> {
    const out = new Map<string, CustomerRevenue>();
    if (!this.isConfigured() || customerIds.length === 0) return out;

    const payments = await this.prisma.payment.findMany({
      where: {
        OR: [{ userId: { in: customerIds } }, { orgId: { in: customerIds } }],
        status: { in: ['success', 'refunded'] },
      },
      select: {
        userId: true,
        orgId: true,
        amountKobo: true,
        status: true,
        paidAt: true,
      },
    });

    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        OR: [{ userId: { in: customerIds } }, { orgId: { in: customerIds } }],
      },
      select: { userId: true, orgId: true, planId: true, status: true },
    });
    const planFor = new Map(
      subscriptions.map((s) => [
        (s.userId ?? s.orgId) as string,
        { plan: s.planId, status: s.status },
      ]),
    );

    for (const p of payments) {
      const key = (p.userId ?? p.orgId) as string;
      const signed = p.status === 'refunded' ? -p.amountKobo : p.amountKobo;
      const existing = out.get(key);
      const lastPaymentAt =
        p.paidAt &&
        (!existing?.lastPaymentAt ||
          p.paidAt.toISOString() > existing.lastPaymentAt)
          ? p.paidAt.toISOString()
          : (existing?.lastPaymentAt ?? null);

      out.set(key, {
        netRevenueCents: (existing?.netRevenueCents ?? 0) + signed,
        currency: CURRENCY,
        plan: planFor.get(key)?.plan ?? null,
        subscriptionStatus: planFor.get(key)?.status ?? null,
        lastPaymentAt,
      });
    }

    return out;
  }

  private async sum(where: Record<string, unknown>): Promise<number> {
    const result = await this.prisma.payment.aggregate({
      where,
      _sum: { amountKobo: true },
    });
    return result._sum.amountKobo ?? 0;
  }
}
