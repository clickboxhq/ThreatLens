import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PaystackClient } from './paystack.client';
import { AppException } from '../../common/exceptions/app-exception';
import { PLAN_PRICES, type PlanId, type BillingInterval } from './plan-prices';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

export const TRIAL_DAYS = 7;
/**
 * The token amount charged to capture a card for a trial, in kobo.
 *
 * Paystack issues a reusable authorisation only off a real transaction, so this is the
 * smallest honest way to put a card on file. It is refunded the moment the authorisation
 * comes back.
 */
export const CARD_VERIFICATION_KOBO = 5_000;

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackClient,
    private readonly config: ConfigService,
  ) {}

  /**
   * Starts a payment and hands back the URL to send the browser to.
   *
   * It records nothing. A started checkout is not a payment, and the ledger only ever moves
   * on a signed webhook — someone who abandons the Paystack page, or who crafts a request to
   * this endpoint, must not leave a subscription behind.
   */
  async start(
    user: AuthenticatedUser,
    planId: PlanId,
    interval: BillingInterval,
    orgId: string | null,
    trial = false,
  ): Promise<{
    authorizationUrl: string;
    reference: string;
    testMode: boolean;
    trial: {
      days: number;
      verificationKobo: number;
      firstChargeKobo: number;
      firstChargeAt: string;
    } | null;
  }> {
    if (!this.paystack.isConfigured()) {
      throw new AppException(
        503,
        'PAYMENTS_UNAVAILABLE',
        'Payments are not available yet.',
      );
    }

    const price = PLAN_PRICES[planId]?.[interval];
    if (!price) {
      throw new AppException(400, 'UNKNOWN_PLAN', 'No such plan and interval.');
    }

    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, orgId: true },
    });
    if (!account) {
      throw new AppException(404, 'NOT_FOUND', 'Account not found.');
    }

    // Buying seats for an organisation is only ever allowed for the caller's own
    // organisation. Without this, any authenticated user could attach a subscription to a
    // tenant they have nothing to do with.
    let seatsFor: string | null = null;
    if (orgId) {
      if (account.orgId !== orgId) {
        throw new AppException(
          403,
          'FORBIDDEN',
          'You can only buy a subscription for your own organisation.',
        );
      }
      seatsFor = orgId;
    }

    // A trial is only honest if the charge at the end of it is actually scheduled. Without a
    // plan code there is nothing to schedule, so refuse rather than hand out a free period
    // that silently never converts.
    if (trial) {
      if (interval !== 'monthly') {
        throw new AppException(
          400,
          'TRIAL_NOT_AVAILABLE',
          'The free trial applies to the monthly plan.',
        );
      }
      if (!price.paystackPlanCode) {
        throw new AppException(
          503,
          'PAYMENTS_UNAVAILABLE',
          'Trials are not available yet.',
        );
      }
      const already = await this.prisma.subscription.findFirst({
        where: seatsFor ? { orgId: seatsFor } : { userId: user.id },
        select: { id: true },
      });
      if (already) {
        throw new AppException(
          409,
          'TRIAL_ALREADY_USED',
          'This account has already started a subscription.',
        );
      }
    }

    const reference = `tl_${randomUUID().replace(/-/g, '')}`;
    const webOrigin =
      this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:8080';

    const initialized = await this.paystack.initializeTransaction({
      email: account.email,
      // A trial charges a token amount to capture the card. Paystack issues a reusable
      // authorisation only off a real transaction — there is no zero-amount card save — and
      // it is refunded as soon as the authorisation comes back.
      amountKobo: trial ? CARD_VERIFICATION_KOBO : price.amountKobo,
      reference,
      // Back to the billing page itself rather than a dedicated return route: the page
      // already knows how to describe every subscription state, and the reference only tells
      // it to wait for the webhook rather than to trust the redirect.
      callbackUrl: `${webOrigin}/app/billing?reference=${reference}`,
      // On a trial the subscription is created afterwards with a start date, so no plan goes
      // on this transaction. Monthly recurs through a Paystack plan; annual is a one-off
      // charge — see the Subscription model for why annual is not a stored-card plan.
      planCode:
        !trial && interval === 'monthly' ? price.paystackPlanCode : null,
      metadata: {
        userId: seatsFor ? null : user.id,
        orgId: seatsFor,
        planId,
        interval,
        ...(trial ? { kind: 'card_verification', trialDays: TRIAL_DAYS } : {}),
      },
    });

    return {
      authorizationUrl: initialized.authorizationUrl,
      reference: initialized.reference,
      testMode: this.paystack.isTestMode(),
      // What the page must tell them before they enter a card.
      trial: trial
        ? {
            days: TRIAL_DAYS,
            verificationKobo: CARD_VERIFICATION_KOBO,
            firstChargeKobo: price.amountKobo,
            firstChargeAt: new Date(
              Date.now() + TRIAL_DAYS * 86400000,
            ).toISOString(),
          }
        : null,
    };
  }
}
