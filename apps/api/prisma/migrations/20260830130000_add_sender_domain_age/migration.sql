-- Sender domain registration date. Domain age is among the strongest objective phishing
-- signals: campaign infrastructure is typically registered days before use, while a genuine
-- corporate domain has years of history. Nullable — a resolver does not always return one.
ALTER TABLE "email_messages"
  ADD COLUMN "sender_domain_registered_at" TIMESTAMP(3);
