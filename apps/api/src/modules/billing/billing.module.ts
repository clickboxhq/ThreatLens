import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingWebhookService } from './billing-webhook.service';
import { CheckoutService } from './checkout.service';
import { CancellationService } from './cancellation.service';
import { PaystackClient } from './paystack.client';
import { SubscriptionService } from './subscription.service';
import { TrialReminderService } from './trial-reminder.service';
import { EmailService } from '../../common/email/email.service';
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
    TrialReminderService,
    // Provided here, not inherited: EmailService is per-module in this codebase, and a
    // module that injects it without providing it compiles, passes its unit tests, and
    // then fails at boot. app.module.spec is what catches that.
    EmailService,
  ],
  exports: [BillingService, SubscriptionService],
})
export class BillingModule {}
