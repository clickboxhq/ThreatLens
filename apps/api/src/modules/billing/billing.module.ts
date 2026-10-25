import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingWebhookService } from './billing-webhook.service';
import { CheckoutService } from './checkout.service';
import { CancellationService } from './cancellation.service';
import { PaystackClient } from './paystack.client';
import { SubscriptionService } from './subscription.service';
import {
  BillingController,
  PaystackWebhookController,
} from './billing.controller';

// SubscriptionService is exported so feature gating elsewhere can ask one question — does
// this account have paid access — without every module learning what a subscription is.
@Module({
  controllers: [BillingController, PaystackWebhookController],
  providers: [
    BillingService,
    BillingWebhookService,
    CheckoutService,
    CancellationService,
    PaystackClient,
    SubscriptionService,
  ],
  exports: [BillingService, SubscriptionService],
})
export class BillingModule {}
