import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaystackClient } from './paystack.client';
import { AppException } from '../../common/exceptions/app-exception';
import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

/**
 * Cancelling a subscription, which a card-upfront trial makes obligatory rather than nice to
 * have: the moment you hold someone's card against a future charge, the way to stop that
 * charge has to be as easy as starting it was.
 *
 * Cancelling never ends access immediately. A trial runs to the end of its free week and a
 * paid month runs to the end of the month already bought — taking the time away would be
 * keeping money for something not delivered, and it also punishes the person for cancelling
 * early rather than letting them forget and be charged.
 */
@Injectable()
export class CancellationService {
  private readonly logger = new Logger(CancellationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackClient,
  ) {}

  async cancel(
    user: AuthenticatedUser,
  ): Promise<{ status: string; accessUntil: string }> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId: user.id },
    });
    if (!subscription) {
      throw new AppException(
        404,
        'NO_SUBSCRIPTION',
        'There is no subscription on this account.',
      );
    }
    if (subscription.status === 'cancelled') {
      return {
        status: subscription.status,
        accessUntil: subscription.currentPeriodEnd.toISOString(),
      };
    }

    // Stop the provider first. If the local row were marked cancelled and this failed, the
    // person would believe they had cancelled and still be charged — the one outcome that
    // must not happen.
    if (
      subscription.paystackSubscriptionCode &&
      subscription.paystackEmailToken
    ) {
      try {
        await this.paystack.disableSubscription({
          subscriptionCode: subscription.paystackSubscriptionCode,
          emailToken: subscription.paystackEmailToken,
        });
      } catch (err) {
        this.logger.error(
          `Paystack refused to disable ${subscription.paystackSubscriptionCode}: ${(err as Error).message}`,
        );
        throw new AppException(
          502,
          'CANCELLATION_FAILED',
          'We could not cancel with the payment provider. Nothing has changed — please try again.',
        );
      }
    } else {
      // No provider subscription to stop: an annual one-off, or a trial whose scheduling
      // never completed. Cancelling locally is the whole job.
      this.logger.log(
        `Cancelling subscription ${subscription.id} with no Paystack subscription attached.`,
      );
    }

    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });

    return {
      status: updated.status,
      accessUntil: updated.currentPeriodEnd.toISOString(),
    };
  }
}
