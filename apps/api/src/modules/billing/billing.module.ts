import { Global, Module } from '@nestjs/common';
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

// Global because entitlement became cross-cutting the moment ThreatLens stopped having a free
// tier: SubscriptionGuard sits on almost every product controller, and it needs
// SubscriptionService resolvable in each of their modules. The alternative is importing this
// module in fifteen places and silently breaking the paywall in the sixteenth.
@Global()
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
