import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PaystackClient } from './paystack.client';
import { AppException } from '../../common/exceptions/app-exception';
import { PLAN_PRICES, type PlanId, type BillingInterval } from './plan-prices';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

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
  ): Promise<{
    authorizationUrl: string;
    reference: string;
    testMode: boolean;
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

    const reference = `tl_${randomUUID().replace(/-/g, '')}`;
    const webOrigin =
      this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:8080';

    const initialized = await this.paystack.initializeTransaction({
      email: account.email,
      amountKobo: price.amountKobo,
      reference,
      callbackUrl: `${webOrigin}/app/billing/return?reference=${reference}`,
      // Monthly recurs through a Paystack plan; annual is a one-off charge, so it carries no
      // plan code. See the Subscription model for why annual is not a stored-card plan.
      planCode: interval === 'monthly' ? price.paystackPlanCode : null,
      metadata: {
        userId: seatsFor ? null : user.id,
        orgId: seatsFor,
        planId,
        interval,
      },
    });

    return {
      authorizationUrl: initialized.authorizationUrl,
      reference: initialized.reference,
      testMode: this.paystack.isTestMode(),
    };
  }
}
