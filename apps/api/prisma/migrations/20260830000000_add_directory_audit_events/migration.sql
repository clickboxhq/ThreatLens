-- CreateEnum
CREATE TYPE "DirectoryAuditCategory" AS ENUM ('credential', 'mfa', 'group_membership', 'role_assignment', 'account_lifecycle', 'mailbox_rule');

-- CreateEnum
CREATE TYPE "DirectoryAuditResult" AS ENUM ('success', 'failure');

-- CreateTable
CREATE TABLE "directory_audit_events" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "correlation_id" UUID,
    "target_identity_id" UUID NOT NULL,
    "actor_identity_id" UUID,
    "actor_display_name" TEXT NOT NULL,
    "category" "DirectoryAuditCategory" NOT NULL,
    "action" TEXT NOT NULL,
    "result" "DirectoryAuditResult" NOT NULL DEFAULT 'success',
    "detail" JSONB,
    "source_ip" TEXT NOT NULL,
    "is_ground_truth_evidence" BOOLEAN NOT NULL DEFAULT false,
    "mitre_technique_id" UUID,

    CONSTRAINT "directory_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "directory_audit_events_session_id_target_identity_id_idx" ON "directory_audit_events"("session_id", "target_identity_id");

-- AddForeignKey
ALTER TABLE "directory_audit_events" ADD CONSTRAINT "directory_audit_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "investigation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_audit_events" ADD CONSTRAINT "directory_audit_events_target_identity_id_fkey" FOREIGN KEY ("target_identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_audit_events" ADD CONSTRAINT "directory_audit_events_actor_identity_id_fkey" FOREIGN KEY ("actor_identity_id") REFERENCES "identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- New table, so 20260827130000's default-privileges fix already grants it to socverse_app —
-- no manual GRANT needed, same as 20260829000000/20260829010000.
