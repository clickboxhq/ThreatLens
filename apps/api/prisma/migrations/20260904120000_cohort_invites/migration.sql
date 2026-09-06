-- Cohort invitations: name a person, email them a link, let them join.
--
-- Distinct from the join code on cohorts, which is a shared secret anyone can pass on. An
-- invite is addressed to one email, can be revoked, expires on its own, and records who sent
-- it. It can also carry a group so the invitee arrives already placed.

CREATE TYPE "CohortInviteStatus" AS ENUM ('pending', 'accepted', 'revoked');

CREATE TABLE "cohort_invites" (
    "id"          UUID NOT NULL,
    "cohort_id"   UUID NOT NULL,
    "group_id"    UUID,
    "email"       CITEXT NOT NULL,
    "token"       TEXT NOT NULL,
    "status"      "CohortInviteStatus" NOT NULL DEFAULT 'pending',
    "invited_by"  UUID NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at"  TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),

    CONSTRAINT "cohort_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cohort_invites_token_key" ON "cohort_invites"("token");

-- One live invite per address per cohort. Re-inviting updates the row rather than leaving a
-- trail of older tokens that all still open the same door.
CREATE UNIQUE INDEX "cohort_invites_cohort_id_email_key" ON "cohort_invites"("cohort_id", "email");

CREATE INDEX "cohort_invites_cohort_id_idx" ON "cohort_invites"("cohort_id");

ALTER TABLE "cohort_invites" ADD CONSTRAINT "cohort_invites_cohort_id_fkey"
    FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The group can be deleted while an invite for it is outstanding; the invite stays valid and
-- simply lands the person in the cohort ungrouped, rather than breaking the link entirely.
ALTER TABLE "cohort_invites" ADD CONSTRAINT "cohort_invites_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "cohort_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cohort_invites" ADD CONSTRAINT "cohort_invites_invited_by_fkey"
    FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Accepting an invite notifies whoever sent it. Safe inside the migration transaction on
-- PostgreSQL 12+ because the new value is only written at runtime, never in this migration.
ALTER TYPE "NotificationCategory" ADD VALUE IF NOT EXISTS 'cohort_invitation';
