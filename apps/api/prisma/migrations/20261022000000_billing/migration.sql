-- Billing: subscriptions, the payment ledger, and the webhook delivery log.

CREATE TYPE "BillingInterval" AS ENUM ('monthly', 'annual');
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'expired');
CREATE TYPE "PaymentStatus" AS ENUM ('success', 'failed', 'refunded');
-- A card-verification charge is money that moved but is not revenue; it is refunded as soon
-- as the authorisation it exists to create comes back.
CREATE TYPE "PaymentKind" AS ENUM ('subscription', 'card_verification');

CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "org_id" UUID,
    "plan_id" TEXT NOT NULL,
    "interval" "BillingInterval" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "seats" INTEGER NOT NULL DEFAULT 1,
    "paystack_customer_code" TEXT,
    "paystack_subscription_code" TEXT,
    "paystack_plan_code" TEXT,
    "paystack_authorization_code" TEXT,
    "paystack_email_token" TEXT,
    "trial_ends_at" TIMESTAMP(3),
    "trial_reminder_sent_at" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- A subscription belongs to a person or to an organisation, never to both and never to
-- neither. Prisma cannot express "exactly one of these", so it is enforced here: without it
-- a row with both set would be billed once and grant access twice.
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_one_owner"
    CHECK ((("user_id" IS NOT NULL)::int + ("org_id" IS NOT NULL)::int) = 1);

CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");
CREATE UNIQUE INDEX "subscriptions_org_id_key" ON "subscriptions"("org_id");
CREATE UNIQUE INDEX "subscriptions_paystack_subscription_code_key" ON "subscriptions"("paystack_subscription_code");
CREATE INDEX "subscriptions_status_current_period_end_idx" ON "subscriptions"("status", "current_period_end");

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "subscription_id" UUID,
    "user_id" UUID,
    "org_id" UUID,
    "reference" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL DEFAULT 'subscription',
    "amount_kobo" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PaymentStatus" NOT NULL,
    "paid_at" TIMESTAMP(3),
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- The provider's transaction reference. Unique because a redelivered webhook must not be
-- able to credit the same money twice, even if the dedupe log were lost.
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");
CREATE INDEX "payments_org_id_idx" ON "payments"("org_id");
CREATE INDEX "payments_status_paid_at_idx" ON "payments"("status", "paid_at");

-- SET NULL rather than CASCADE: a subscription going away must never take the record of
-- money that changed hands with it.
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'paystack',
    "dedupe_key" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "webhook_events_dedupe_key_key" ON "webhook_events"("dedupe_key");
CREATE INDEX "webhook_events_provider_event_type_received_at_idx" ON "webhook_events"("provider", "event_type", "received_at");

-- New tables: socverse_app needs an explicit grant (migrations run as a different role).
GRANT SELECT, INSERT, UPDATE, DELETE ON "subscriptions" TO "socverse_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON "payments" TO "socverse_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON "webhook_events" TO "socverse_app";
