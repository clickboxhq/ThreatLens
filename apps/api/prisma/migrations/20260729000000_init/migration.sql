-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('student', 'instructor', 'org_admin', 'platform_admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'pending_verification');

-- CreateEnum
CREATE TYPE "ScenarioCategory" AS ENUM ('identity', 'endpoint', 'email', 'cloud', 'insider_threat', 'web', 'malware', 'ransomware');

-- CreateEnum
CREATE TYPE "ScenarioDifficulty" AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');

-- CreateEnum
CREATE TYPE "ScenarioStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('active', 'submitted', 'scored', 'abandoned');

-- CreateEnum
CREATE TYPE "IdentityRiskLevel" AS ENUM ('none', 'low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "MfaStatus" AS ENUM ('enforced', 'registered_not_enforced', 'not_registered');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'disabled', 'locked');

-- CreateEnum
CREATE TYPE "DeviceRiskLevel" AS ENUM ('none', 'low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "IsolationStatus" AS ENUM ('not_isolated', 'isolated');

-- CreateEnum
CREATE TYPE "SignInResult" AS ENUM ('success', 'failure', 'mfa_denied', 'blocked_by_ca');

-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('inbound', 'outbound', 'internal');

-- CreateEnum
CREATE TYPE "SpfResult" AS ENUM ('pass', 'fail', 'softfail', 'none');

-- CreateEnum
CREATE TYPE "DkimResult" AS ENUM ('pass', 'fail', 'none');

-- CreateEnum
CREATE TYPE "DmarcResult" AS ENUM ('pass', 'fail', 'none');

-- CreateEnum
CREATE TYPE "SandboxVerdict" AS ENUM ('benign', 'suspicious', 'malicious', 'not_analyzed');

-- CreateEnum
CREATE TYPE "IndicatorReputation" AS ENUM ('malicious', 'suspicious', 'unknown', 'known_good');

-- CreateEnum
CREATE TYPE "IndicatorType" AS ENUM ('hash', 'ip', 'domain', 'url');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('informational', 'low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('new', 'in_progress', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('identity', 'device', 'mailbox');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('open', 'investigating', 'contained', 'closed', 'reopened');

-- CreateEnum
CREATE TYPE "IncidentVerdict" AS ENUM ('true_positive', 'false_positive', 'benign_positive');

-- CreateEnum
CREATE TYPE "InvestigationActionType" AS ENUM ('view_entity', 'search', 'add_to_timeline', 'pin_evidence', 'isolate_device', 'disable_account', 'block_sender', 'dismiss_alert', 'escalate_to_incident', 'submit_verdict');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "org_id" UUID,
    "email" CITEXT NOT NULL,
    "password_hash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'student',
    "display_name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "email_verified_at" TIMESTAMP(3),
    "session_version" INTEGER NOT NULL DEFAULT 1,
    "last_login_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_label" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_token_id" UUID,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mitre_techniques" (
    "id" UUID NOT NULL,
    "technique_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tactic" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT,

    CONSTRAINT "mitre_techniques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attack_scenarios" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "category" "ScenarioCategory" NOT NULL,
    "difficulty" "ScenarioDifficulty" NOT NULL,
    "estimated_minutes" INTEGER NOT NULL,
    "status" "ScenarioStatus" NOT NULL DEFAULT 'draft',
    "current_version_id" UUID,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attack_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_versions" (
    "id" UUID NOT NULL,
    "scenario_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "ground_truth_definition" JSONB NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_by" UUID,

    CONSTRAINT "scenario_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_techniques" (
    "scenario_version_id" UUID NOT NULL,
    "mitre_technique_id" UUID NOT NULL,
    "is_required_for_full_credit" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "scenario_techniques_pkey" PRIMARY KEY ("scenario_version_id","mitre_technique_id")
);

-- CreateTable
CREATE TABLE "investigation_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "scenario_id" UUID NOT NULL,
    "scenario_version_id" UUID NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'active',
    "seed" BIGINT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "current_scenario_time" TIMESTAMP(3),

    CONSTRAINT "investigation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identities" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "user_principal_name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "job_title" TEXT NOT NULL,
    "manager_identity_id" UUID,
    "risk_level" "IdentityRiskLevel" NOT NULL DEFAULT 'none',
    "mfa_status" "MfaStatus" NOT NULL,
    "account_status" "AccountStatus" NOT NULL DEFAULT 'active',
    "is_privileged" BOOLEAN NOT NULL DEFAULT false,
    "home_country" TEXT NOT NULL,
    "is_ground_truth_actor" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conditional_access_evaluations" (
    "id" UUID NOT NULL,
    "identity_id" UUID NOT NULL,
    "sign_in_event_id" UUID,
    "policy_name" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "reasons" JSONB,

    CONSTRAINT "conditional_access_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "hostname" TEXT NOT NULL,
    "os_platform" TEXT NOT NULL,
    "os_version" TEXT NOT NULL,
    "primary_identity_id" UUID,
    "risk_level" "DeviceRiskLevel" NOT NULL DEFAULT 'none',
    "isolation_status" "IsolationStatus" NOT NULL DEFAULT 'not_isolated',
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "is_ground_truth_actor" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sign_in_events" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "correlation_id" UUID,
    "raw" JSONB NOT NULL,
    "is_ground_truth_evidence" BOOLEAN NOT NULL DEFAULT false,
    "mitre_technique_id" UUID,
    "identity_id" UUID NOT NULL,
    "device_id" UUID,
    "source_ip" TEXT NOT NULL,
    "source_country" TEXT NOT NULL,
    "source_city" TEXT NOT NULL,
    "application" TEXT NOT NULL,
    "result" "SignInResult" NOT NULL,
    "failure_reason" TEXT,
    "is_legacy_auth" BOOLEAN NOT NULL DEFAULT false,
    "client_app" TEXT NOT NULL,

    CONSTRAINT "sign_in_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_messages" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "correlation_id" UUID,
    "message_id" TEXT NOT NULL,
    "direction" "EmailDirection" NOT NULL,
    "sender_address" TEXT NOT NULL,
    "sender_display_name" TEXT NOT NULL,
    "recipient_addresses" TEXT[],
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "headers_raw" JSONB NOT NULL,
    "spf_result" "SpfResult" NOT NULL,
    "dkim_result" "DkimResult" NOT NULL,
    "dmarc_result" "DmarcResult" NOT NULL,
    "is_ground_truth_evidence" BOOLEAN NOT NULL DEFAULT false,
    "mitre_technique_id" UUID,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_attachments" (
    "id" UUID NOT NULL,
    "email_message_id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "hash_sha256" TEXT NOT NULL,
    "sandbox_verdict" "SandboxVerdict" NOT NULL DEFAULT 'not_analyzed',

    CONSTRAINT "email_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_urls" (
    "id" UUID NOT NULL,
    "email_message_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "display_text" TEXT NOT NULL,
    "reputation" "IndicatorReputation" NOT NULL DEFAULT 'unknown',
    "is_rewritten_by_safe_links" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "email_urls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threat_intel_indicators" (
    "id" UUID NOT NULL,
    "scenario_version_id" UUID NOT NULL,
    "indicator_type" "IndicatorType" NOT NULL,
    "value" TEXT NOT NULL,
    "reputation" "IndicatorReputation" NOT NULL,
    "actor_attribution" TEXT,
    "context" TEXT NOT NULL,

    CONSTRAINT "threat_intel_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detection_rules" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "logic_summary" TEXT NOT NULL,
    "default_severity" "AlertSeverity" NOT NULL,
    "mitre_technique_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "detection_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'new',
    "dismissal_reason" TEXT,
    "primary_entity_type" "EntityType" NOT NULL,
    "primary_entity_id" UUID NOT NULL,
    "mitre_technique_id" UUID,
    "detection_rule_id" UUID,
    "dedup_count" INTEGER NOT NULL DEFAULT 1,
    "is_false_positive_by_design" BOOLEAN NOT NULL DEFAULT false,
    "related_alert_id" UUID,
    "first_seen_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_evidence_refs" (
    "id" UUID NOT NULL,
    "alert_id" UUID NOT NULL,
    "event_table" TEXT NOT NULL,
    "event_id" UUID NOT NULL,

    CONSTRAINT "alert_evidence_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'open',
    "verdict" "IncidentVerdict",
    "summary" TEXT,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_alerts" (
    "incident_id" UUID NOT NULL,
    "alert_id" UUID NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_alerts_pkey" PRIMARY KEY ("incident_id","alert_id")
);

-- CreateTable
CREATE TABLE "incident_techniques" (
    "incident_id" UUID NOT NULL,
    "mitre_technique_id" UUID NOT NULL,

    CONSTRAINT "incident_techniques_pkey" PRIMARY KEY ("incident_id","mitre_technique_id")
);

-- CreateTable
CREATE TABLE "evidence_collection" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "event_table" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "justification" TEXT NOT NULL,
    "mitre_technique_id" UUID,
    "pinned_by" UUID NOT NULL,
    "pinned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyst_notes" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analyst_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investigation_actions" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "incident_id" UUID,
    "user_id" UUID NOT NULL,
    "action_type" "InvestigationActionType" NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "metadata" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investigation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scores" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "overall_percent" DECIMAL(5,2) NOT NULL,
    "technique_accuracy_percent" DECIMAL(5,2) NOT NULL,
    "evidence_precision_percent" DECIMAL(5,2) NOT NULL,
    "evidence_recall_percent" DECIMAL(5,2) NOT NULL,
    "false_positive_count" INTEGER NOT NULL,
    "hint_penalty_percent" DECIMAL(5,2) NOT NULL,
    "time_to_resolution_seconds" INTEGER NOT NULL,
    "verdict_correct" BOOLEAN NOT NULL,
    "rubric_breakdown" JSONB NOT NULL,
    "scored_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_replaced_by_token_id_key" ON "refresh_tokens"("replaced_by_token_id");

-- CreateIndex
CREATE UNIQUE INDEX "mitre_techniques_technique_id_key" ON "mitre_techniques"("technique_id");

-- CreateIndex
CREATE UNIQUE INDEX "attack_scenarios_slug_key" ON "attack_scenarios"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "attack_scenarios_current_version_id_key" ON "attack_scenarios"("current_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "scenario_versions_scenario_id_version_number_key" ON "scenario_versions"("scenario_id", "version_number");

-- CreateIndex
CREATE INDEX "investigation_sessions_user_id_status_idx" ON "investigation_sessions"("user_id", "status");

-- CreateIndex
CREATE INDEX "investigation_sessions_scenario_id_idx" ON "investigation_sessions"("scenario_id");

-- CreateIndex
CREATE INDEX "identities_session_id_idx" ON "identities"("session_id");

-- CreateIndex
CREATE INDEX "devices_session_id_idx" ON "devices"("session_id");

-- CreateIndex
CREATE INDEX "sign_in_events_session_id_identity_id_occurred_at_idx" ON "sign_in_events"("session_id", "identity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "email_messages_session_id_idx" ON "email_messages"("session_id");

-- CreateIndex
CREATE INDEX "threat_intel_indicators_scenario_version_id_indicator_type__idx" ON "threat_intel_indicators"("scenario_version_id", "indicator_type", "value");

-- CreateIndex
CREATE INDEX "alerts_session_id_status_idx" ON "alerts"("session_id", "status");

-- CreateIndex
CREATE INDEX "incidents_session_id_idx" ON "incidents"("session_id");

-- CreateIndex
CREATE INDEX "investigation_actions_session_id_occurred_at_idx" ON "investigation_actions"("session_id", "occurred_at");

-- CreateIndex
CREATE INDEX "investigation_actions_session_id_action_type_idx" ON "investigation_actions"("session_id", "action_type");

-- CreateIndex
CREATE UNIQUE INDEX "scores_session_id_key" ON "scores"("session_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_token_id_fkey" FOREIGN KEY ("replaced_by_token_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attack_scenarios" ADD CONSTRAINT "attack_scenarios_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attack_scenarios" ADD CONSTRAINT "attack_scenarios_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "scenario_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_versions" ADD CONSTRAINT "scenario_versions_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "attack_scenarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_versions" ADD CONSTRAINT "scenario_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_techniques" ADD CONSTRAINT "scenario_techniques_scenario_version_id_fkey" FOREIGN KEY ("scenario_version_id") REFERENCES "scenario_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenario_techniques" ADD CONSTRAINT "scenario_techniques_mitre_technique_id_fkey" FOREIGN KEY ("mitre_technique_id") REFERENCES "mitre_techniques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_sessions" ADD CONSTRAINT "investigation_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_sessions" ADD CONSTRAINT "investigation_sessions_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "attack_scenarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_sessions" ADD CONSTRAINT "investigation_sessions_scenario_version_id_fkey" FOREIGN KEY ("scenario_version_id") REFERENCES "scenario_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identities" ADD CONSTRAINT "identities_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "investigation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identities" ADD CONSTRAINT "identities_manager_identity_id_fkey" FOREIGN KEY ("manager_identity_id") REFERENCES "identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_access_evaluations" ADD CONSTRAINT "conditional_access_evaluations_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conditional_access_evaluations" ADD CONSTRAINT "conditional_access_evaluations_sign_in_event_id_fkey" FOREIGN KEY ("sign_in_event_id") REFERENCES "sign_in_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "investigation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_primary_identity_id_fkey" FOREIGN KEY ("primary_identity_id") REFERENCES "identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_in_events" ADD CONSTRAINT "sign_in_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "investigation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_in_events" ADD CONSTRAINT "sign_in_events_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sign_in_events" ADD CONSTRAINT "sign_in_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "investigation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_email_message_id_fkey" FOREIGN KEY ("email_message_id") REFERENCES "email_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_urls" ADD CONSTRAINT "email_urls_email_message_id_fkey" FOREIGN KEY ("email_message_id") REFERENCES "email_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threat_intel_indicators" ADD CONSTRAINT "threat_intel_indicators_scenario_version_id_fkey" FOREIGN KEY ("scenario_version_id") REFERENCES "scenario_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "investigation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_detection_rule_id_fkey" FOREIGN KEY ("detection_rule_id") REFERENCES "detection_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_mitre_technique_id_fkey" FOREIGN KEY ("mitre_technique_id") REFERENCES "mitre_techniques"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_related_alert_id_fkey" FOREIGN KEY ("related_alert_id") REFERENCES "alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_evidence_refs" ADD CONSTRAINT "alert_evidence_refs_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "investigation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_alerts" ADD CONSTRAINT "incident_alerts_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_alerts" ADD CONSTRAINT "incident_alerts_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_techniques" ADD CONSTRAINT "incident_techniques_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_techniques" ADD CONSTRAINT "incident_techniques_mitre_technique_id_fkey" FOREIGN KEY ("mitre_technique_id") REFERENCES "mitre_techniques"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_collection" ADD CONSTRAINT "evidence_collection_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_collection" ADD CONSTRAINT "evidence_collection_pinned_by_fkey" FOREIGN KEY ("pinned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyst_notes" ADD CONSTRAINT "analyst_notes_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyst_notes" ADD CONSTRAINT "analyst_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_actions" ADD CONSTRAINT "investigation_actions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "investigation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_actions" ADD CONSTRAINT "investigation_actions_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investigation_actions" ADD CONSTRAINT "investigation_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scores" ADD CONSTRAINT "scores_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "investigation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

