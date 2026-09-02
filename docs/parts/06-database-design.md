# 6. Database Design

## 6.1 Conventions & Tenancy Model

- **Primary keys:** every table uses a `UUID` (v4) primary key named `id`, generated application-side or via Postgres `gen_random_uuid()`. UUIDs are used instead of serial integers so that IDs are safe to expose in URLs/APIs without leaking row-count/growth-rate information, and so that pre-generated telemetry (§7.7) can assign IDs before insertion without a round-trip.
- **Timestamps:** every table has `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`; mutable tables also have `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` maintained by a trigger. All timestamps are stored UTC; timezone conversion is a presentation-layer concern only (§17).
- **Soft delete vs. hard delete:** user-owned content that a Student might reasonably want "undone" (notes, evidence pins) is hard-deleted on explicit removal — there is no undo-from-trash feature at MVP. Records with compliance/audit weight (users, audit_logs, scores, certificates) are never hard-deleted; deactivation uses a `deleted_at TIMESTAMPTZ NULL` (soft delete) column instead, and all queries against these tables filter `WHERE deleted_at IS NULL` by default via the repository layer (§5.6).
- **Tenancy model:** ThreatLens is a single database, shared-schema multi-tenant system. Every row that belongs to an institutional customer carries an `org_id UUID NULL REFERENCES organizations(id)` (nullable because individual B2C users have no org). Row-level isolation between orgs is enforced at the application/repository layer (every query scopes by the caller's `org_id` where applicable) rather than Postgres Row-Level Security at MVP, to keep the query layer simple; **migrating to native Postgres RLS is the specified hardening step before onboarding the first enterprise customer with a compliance requirement for defense-in-depth tenant isolation** (§15, noted as a Scale-phase action item, not required for MVP launch).
- **Naming:** tables are `snake_case`, plural nouns. Foreign keys are named `{referenced_table_singular}_id`. Enum-like fields use Postgres `CHECK` constraints or native `ENUM` types (native enums preferred for fields with a small, rarely-changing value set like `severity`; `CHECK` constraints preferred where the value set may grow, to avoid enum-alteration migration friction).

## 6.2 Entity-Relationship Overview

```
organizations 1───* cohorts 1───* cohort_enrollments *───1 users
users 1───* investigation_sessions *───1 attack_scenarios
attack_scenarios 1───* scenario_techniques *───1 mitre_techniques
investigation_sessions 1───* identities, devices, email_messages   (session-scoped synthetic entities)
identities 1───* sign_in_events
devices 1───* process_events, file_events, network_events, dns_events, registry_events
investigation_sessions 1───* alerts 1───* alert_evidence_refs
investigation_sessions 1───* incidents *───* alerts (via incident_alerts)
incidents 1───* evidence_collection, analyst_notes, investigation_actions
investigation_sessions 1───1 scores
incidents 1───* instructor_feedback
users 1───* certificates
users 1───* refresh_tokens
(all mutating actions) ───> audit_logs
```

Every synthetic entity (identity, device, email message, and every event table) carries a `session_id UUID NOT NULL REFERENCES investigation_sessions(id) ON DELETE CASCADE`, because synthetic telemetry has no meaning outside the session that generated it (§7) — this is the single most important foreign key in the schema, and it is what makes per-session data isolation and eventual archival/partitioning (§6.23) straightforward.

## 6.3 `users` and `roles`

**`users`**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| org_id | UUID | FK → organizations, NULL | NULL for individual B2C accounts |
| email | CITEXT | UNIQUE NOT NULL | case-insensitive |
| password_hash | TEXT | NULL | NULL if SSO-only account; argon2id, §15.1 |
| role | ENUM | NOT NULL | `student`, `instructor`, `org_admin`, `platform_admin` (§15.2) |
| display_name | TEXT | NOT NULL | |
| status | ENUM | NOT NULL DEFAULT 'active' | `active`, `suspended`, `pending_verification` |
| email_verified_at | TIMESTAMPTZ | NULL | |
| sso_provider | TEXT | NULL | `saml`, `oidc`, NULL if password auth |
| sso_subject | TEXT | NULL | provider-side subject identifier |
| session_version | INTEGER | NOT NULL DEFAULT 1 | incremented to invalidate all issued access tokens (§5.7) |
| last_login_at | TIMESTAMPTZ | NULL | |
| deleted_at | TIMESTAMPTZ | NULL | soft delete (§6.1) |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL | |

Indexes: `UNIQUE (email) WHERE deleted_at IS NULL`; `INDEX (org_id)`.

A separate `roles` table is **not** used as a many-to-many join for MVP — the four platform roles in §15.2 are coarse and mutually exclusive per user, so a single `role` enum column is the correct normalization (avoiding an unnecessary join on every authorization check, which is a hot path). Fine-grained **permissions** (e.g., "can this specific instructor edit this specific cohort") are modeled as ownership foreign keys (`cohorts.owner_id`) checked at the resource-level authorization step (§4.3), not as a separate permissions table. If ThreatLens later needs custom/composable roles (e.g., enterprise customers wanting a "read-only auditor" role), a `roles` and `user_roles` join table would be introduced then; the `role` enum column is kept as a computed convenience field for backward compatibility rather than removed, to avoid a breaking change to every existing authorization check.

## 6.4 `organizations`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| name | TEXT | NOT NULL | |
| plan | ENUM | NOT NULL | `trial`, `institutional`, `enterprise` (§1.7) |
| seat_limit | INTEGER | NOT NULL | |
| sso_enabled | BOOLEAN | NOT NULL DEFAULT false | |
| sso_config | JSONB | NULL | provider metadata (§5.5), secrets referenced not embedded (§15.8) |
| billing_customer_id | TEXT | NULL | external billing provider reference, §20 |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL | |

## 6.5 `cohorts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| org_id | UUID | FK → organizations NOT NULL | |
| owner_id | UUID | FK → users NOT NULL | the Instructor who owns this cohort |
| name | TEXT | NOT NULL | |
| join_code | TEXT | UNIQUE NULL | self-service enrollment (§2.15) |
| starts_at / ends_at | DATE | NULL | |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL | |

## 6.6 `cohort_enrollments`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| cohort_id | UUID | FK → cohorts NOT NULL | |
| user_id | UUID | FK → users NOT NULL | |
| enrolled_at | TIMESTAMPTZ | NOT NULL | |
| status | ENUM | NOT NULL DEFAULT 'active' | `active`, `dropped` |

Indexes: `UNIQUE (cohort_id, user_id)`.

Also `cohort_scenario_assignments` (id, cohort_id FK, scenario_id FK, due_at, attempt_limit, created_by FK→users) supports §2.15's assignment feature.

## 6.7 `attack_scenarios`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| slug | TEXT | UNIQUE NOT NULL | URL-safe identifier |
| title | TEXT | NOT NULL | |
| summary | TEXT | NOT NULL | learner-facing teaser, does not leak ground truth |
| category | ENUM | NOT NULL | `identity`, `endpoint`, `email`, `cloud`, `insider_threat`, `web`, `malware`, `ransomware` (§1.8) |
| difficulty | ENUM | NOT NULL | `beginner`, `intermediate`, `advanced`, `expert` (§12.2) |
| estimated_minutes | INTEGER | NOT NULL | |
| status | ENUM | NOT NULL DEFAULT 'draft' | `draft`, `published`, `archived` (§12.6) |
| current_version_id | UUID | FK → scenario_versions NULL | points at the live version (§12.6) |
| author_id | UUID | FK → users NOT NULL | |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL | |

**`scenario_versions`** (append-only, §12.6): `id`, `scenario_id` FK, `version_number` INTEGER, `ground_truth_definition` JSONB (the authored attack narrative: entities, event templates, injected IOCs, correct technique tags, rubric weights — the schema of this JSON blob is defined in §12.1), `published_at`, `created_by` FK→users. `attack_scenarios.current_version_id` is only repointed after a new version passes the scenario validation pipeline (§12.6), so in-flight sessions always continue against the version they started on (`investigation_sessions.scenario_version_id`, §6.9) even if the scenario is edited mid-session.

**`scenario_techniques`** (join): `scenario_version_id` FK, `mitre_technique_id` FK, `is_required_for_full_credit` BOOLEAN — drives the technique-identification scoring component (§12.4).

## 6.8 `mitre_techniques`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| technique_id | TEXT | UNIQUE NOT NULL | e.g. `T1078`, official ATT&CK ID |
| name | TEXT | NOT NULL | e.g. "Valid Accounts" |
| tactic | TEXT | NOT NULL | e.g. `TA0001` Initial Access — a technique can map to multiple tactics; modeled via a `technique_tactics` join if strict correctness is required, or a denormalized primary-tactic column if single-tactic display is sufficient for MVP UI (MVP choice: denormalized column + optional `secondary_tactics TEXT[]`) |
| description | TEXT | NOT NULL | |
| url | TEXT | NULL | reference link to attack.mitre.org for learner further-reading, not a runtime dependency |

Seeded once from the public MITRE ATT&CK STIX dataset at deploy time (an ingestion script, not a live API dependency — §1.6's "no live external dependency" principle applies here too), refreshed periodically as ATT&CK is updated.

## 6.9 `investigation_sessions`

The central join point between a user, a scenario, and the synthetic world generated for that attempt.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | this is the `session_id` / correlation scope referenced by every synthetic table below and by §2.9's cross-entity correlation |
| user_id | UUID | FK → users NOT NULL | |
| scenario_id | UUID | FK → attack_scenarios NOT NULL | |
| scenario_version_id | UUID | FK → scenario_versions NOT NULL | pinned at session start (§6.7) |
| cohort_assignment_id | UUID | FK → cohort_scenario_assignments NULL | NULL for self-directed practice |
| status | ENUM | NOT NULL DEFAULT 'active' | `active`, `submitted`, `scored`, `abandoned` |
| seed | BIGINT | NOT NULL | RNG seed used by the Telemetry Generator (§7.2) — stored for reproducibility/debugging, never exposed to the client |
| started_at | TIMESTAMPTZ | NOT NULL | |
| submitted_at | TIMESTAMPTZ | NULL | |
| expires_at | TIMESTAMPTZ | NOT NULL | stale-session cleanup horizon (§5.12) |
| current_scenario_time | TIMESTAMPTZ | NULL | for live/time-phased scenarios (§12.7), the simulated "now" |

Indexes: `INDEX (user_id, status)`, `INDEX (scenario_id)`, `INDEX (expires_at) WHERE status = 'active'` (used by the cleanup job, §5.12).

## 6.10 `identities`

Synthetic directory entries for the Identity Portal (§9).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| session_id | UUID | FK → investigation_sessions ON DELETE CASCADE NOT NULL | |
| display_name | TEXT | NOT NULL | synthetic person name |
| user_principal_name | TEXT | NOT NULL | synthetic `user@scenario-corp.example` |
| department | TEXT | NOT NULL | |
| job_title | TEXT | NOT NULL | |
| manager_identity_id | UUID | FK → identities NULL | self-referential |
| risk_level | ENUM | NOT NULL | `none`, `low`, `medium`, `high` — computed by the Alert Engine (§8), not authored directly |
| mfa_status | ENUM | NOT NULL | `enforced`, `registered_not_enforced`, `not_registered` |
| account_status | ENUM | NOT NULL | `active`, `disabled`, `locked` — mutable via the in-scenario "Disable Account" investigation action (§2.20) |
| is_privileged | BOOLEAN | NOT NULL DEFAULT false | e.g. Global Admin-equivalent — used by scenario ground truth for privilege-escalation narratives |
| home_country | TEXT | NOT NULL | ISO 3166-1 alpha-2, used to compute impossible-travel baselines (§9.7) |
| is_ground_truth_actor | BOOLEAN | NOT NULL DEFAULT false | internal-only flag marking whether this identity is part of the authored attack narrative; **never returned by any Student-facing API** (§9.9) |

**`identity_group_memberships`**: `identity_id` FK, `group_name` TEXT, `group_type` ENUM (`security`, `distribution`, `role_assignable`).

**`conditional_access_evaluations`**: `id`, `identity_id` FK, `sign_in_event_id` FK → sign_in_events, `policy_name`, `result` ENUM (`granted`, `blocked`, `mfa_required`), `reasons` JSONB — supports §9's conditional access investigation surface.

## 6.11 `devices`

Synthetic endpoints for the Device Portal (§10).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| session_id | UUID | FK → investigation_sessions ON DELETE CASCADE NOT NULL | |
| hostname | TEXT | NOT NULL | |
| os_platform | ENUM | NOT NULL | `windows`, `linux`, `macos` |
| os_version | TEXT | NOT NULL | |
| primary_identity_id | UUID | FK → identities NULL | primary logged-on user |
| risk_level | ENUM | NOT NULL | computed, mirrors `identities.risk_level` semantics |
| isolation_status | ENUM | NOT NULL DEFAULT 'not_isolated' | `not_isolated`, `isolated` — mutable via §2.20's containment action |
| last_seen_at | TIMESTAMPTZ | NOT NULL | |
| is_ground_truth_actor | BOOLEAN | NOT NULL DEFAULT false | internal-only, mirrors §6.10 |

**`installed_software`**: `device_id` FK, `name`, `version`, `install_date`, `is_known_bad` BOOLEAN (internal-only).
**`device_services`**: `device_id` FK, `service_name`, `start_type`, `status`, `binary_path` — persistence-artifact investigation.
**`startup_entries`**: `device_id` FK, `entry_type` ENUM(`run_key`,`scheduled_task`,`startup_folder`,`service`,`wmi_subscription`), `command`, `location`.
**`usb_events`**: `device_id` FK, `event_type` ENUM(`connected`,`disconnected`), `device_serial`, `volume_label`, `occurred_at`.

## 6.12 Telemetry Event Tables

All event tables below share a common shape and are the direct implementation of §7's "realistic synthetic telemetry" requirement and §2.8's Search feature. Every event table has: `id UUID PK`, `session_id UUID FK NOT NULL`, `occurred_at TIMESTAMPTZ NOT NULL`, `correlation_id UUID NULL` (links events that are part of the same real-world action across entities, e.g., a sign-in and the subsequent process launch it caused — used by §2.9's cross-entity timeline correlation lines), `raw JSONB NOT NULL` (the full synthetic event payload in a shape resembling the real-world log source, so the Search UI's freetext search and the "raw event" detail view have realistic depth to explore), `is_ground_truth_evidence BOOLEAN NOT NULL DEFAULT false` (internal-only: was this event authored as part of the attack narrative, vs. background noise — the single most important column for scoring, §12.4), and `mitre_technique_id UUID FK NULL` (internal-only, set only on ground-truth evidence rows).

### 6.12.1 `sign_in_events`
`identity_id` FK, `device_id` FK NULL, `source_ip` INET, `source_country` TEXT, `source_city` TEXT, `application`, `result` ENUM(`success`,`failure`,`mfa_denied`,`blocked_by_ca`), `failure_reason` TEXT NULL, `is_legacy_auth` BOOLEAN, `client_app` TEXT. Indexed on `(session_id, identity_id, occurred_at)` — the primary access pattern for the Identity Portal's sign-in timeline (§9).

### 6.12.2 `process_events`
`device_id` FK, `process_guid` UUID, `parent_process_guid` UUID NULL, `image_path` TEXT, `command_line` TEXT, `hash_sha256` TEXT, `parent_image_path` TEXT NULL, `integrity_level` TEXT, `identity_id` FK NULL (the logged-on user context). This is the Sysmon-Event-ID-1-shaped table backing the Device Portal's process tree (§10.3); `parent_process_guid` self-references within the same `device_id` to reconstruct the tree.

### 6.12.3 `file_events`
`device_id` FK, `action` ENUM(`created`,`modified`,`deleted`,`renamed`,`encrypted`), `file_path`, `hash_sha256` NULL, `process_guid` FK NULL (which process performed the action) — `encrypted` action type specifically supports ransomware scenarios (§1.8).

### 6.12.4 `network_events`
`device_id` FK, `direction` ENUM(`inbound`,`outbound`), `protocol`, `local_port`, `remote_ip` INET, `remote_port`, `bytes_sent`, `bytes_received`, `process_guid` FK NULL — supports C2 beaconing and exfiltration-volume investigation.

### 6.12.5 `dns_events`
`device_id` FK, `query_name`, `query_type`, `response_ips` INET[], `process_guid` FK NULL — supports C2 domain and DGA-style investigation narratives.

### 6.12.6 `http_requests`
`device_id` FK NULL, `identity_id` FK NULL, `method`, `url`, `user_agent`, `status_code`, `request_headers` JSONB, `source_ip` INET — supports web attack scenarios (webshell access patterns, injection attempts) and proxy-log-style investigation.

### 6.12.7 `registry_events`
`device_id` FK, `action` ENUM(`created`,`modified`,`deleted`), `key_path`, `value_name` NULL, `value_data` NULL, `process_guid` FK NULL — Windows persistence-artifact investigation (Run keys, etc.), feeding `startup_entries` (§6.11) reconciliation.

### 6.12.8 `firewall_events`, `vpn_events`, `proxy_events`, `cloud_events`
Same base shape; `firewall_events` (`action` ENUM `allow`/`deny`, source/dest IP+port, rule_name), `vpn_events` (`identity_id` FK, `source_ip`, `session_duration`, `client`), `proxy_events` (mirrors `http_requests` with `category` classification e.g. `malware`,`phishing`,`uncategorized`), `cloud_events` (`identity_id` FK, `provider` ENUM(`aws-style`,`azure-style`,`saas`), `action_name` e.g. `CreateAccessKey`, `resource_arn`, `source_ip`) — collectively cover §7's Firewall/VPN/Proxy/Cloud log requirement and §1.8's Cloud investigation category.

### 6.12.9 `email_messages`
Detailed further in §11. `session_id` FK, `message_id` TEXT, `direction` ENUM(`inbound`,`outbound`,`internal`), `sender_address`, `sender_display_name`, `recipient_addresses` TEXT[], `subject`, `body_html`, `headers_raw` JSONB (full synthetic header block), `spf_result` ENUM(`pass`,`fail`,`softfail`,`none`), `dkim_result` ENUM(`pass`,`fail`,`none`), `dmarc_result` ENUM(`pass`,`fail`,`none`), `is_ground_truth_evidence` BOOLEAN, `mitre_technique_id` FK NULL.

**`email_attachments`**: `email_message_id` FK, `filename`, `content_type`, `size_bytes`, `hash_sha256`, `sandbox_verdict` ENUM(`benign`,`suspicious`,`malicious`,`not_analyzed`).
**`email_urls`**: `email_message_id` FK, `url`, `display_text`, `reputation` ENUM (mirrors §2.7's TI reputation scale), `is_rewritten_by_safe_links` BOOLEAN.

## 6.13 `investigation_actions`

The audit/replay trail of everything a Student *does* during a session (distinct from `audit_logs`, §6.22, which covers platform-security-relevant actions across the whole product, not just in-scenario investigative actions).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| session_id | UUID | FK → investigation_sessions NOT NULL | |
| incident_id | UUID | FK → incidents NULL | |
| user_id | UUID | FK → users NOT NULL | |
| action_type | ENUM | NOT NULL | `view_entity`, `search`, `add_to_timeline`, `pin_evidence`, `isolate_device`, `disable_account`, `block_sender`, `dismiss_alert`, `escalate_to_incident`, `submit_verdict` (§2.20) |
| target_type | TEXT | NOT NULL | e.g. `device`, `identity`, `email_message`, `alert` |
| target_id | UUID | NOT NULL | polymorphic reference, not FK-constrained (spans many tables) |
| metadata | JSONB | NULL | e.g. dismissal reason, search query text |
| occurred_at | TIMESTAMPTZ | NOT NULL | |

Indexed on `(session_id, occurred_at)` for the Global Timeline replay feature (§2.9) and on `(session_id, action_type)` for scoring queries (§12.4, e.g. "did the Student view the ground-truth-evidence entities at all").

## 6.14 `scores`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| session_id | UUID | FK → investigation_sessions UNIQUE NOT NULL | one score per session |
| overall_percent | NUMERIC(5,2) | NOT NULL | |
| technique_accuracy_percent | NUMERIC(5,2) | NOT NULL | correct technique tags identified / required techniques (§12.4) |
| evidence_precision_percent | NUMERIC(5,2) | NOT NULL | pinned evidence that was actually ground-truth / total pinned |
| evidence_recall_percent | NUMERIC(5,2) | NOT NULL | ground-truth evidence pinned / total ground-truth evidence |
| false_positive_count | INTEGER | NOT NULL | non-ground-truth items pinned as evidence or wrongly escalated |
| hint_penalty_percent | NUMERIC(5,2) | NOT NULL | §12.5 |
| time_to_resolution_seconds | INTEGER | NOT NULL | |
| verdict_correct | BOOLEAN | NOT NULL | did the final True/False/Benign Positive verdict match ground truth |
| rubric_breakdown | JSONB | NOT NULL | full itemized rubric result, rendered on the results screen (§2.12) |
| scored_at | TIMESTAMPTZ | NOT NULL | |

**`score_history`** (append-only, not shown in full): retains prior scoring runs if a session is re-scored after a scoring-engine bugfix, so historical leaderboard/analytics data can be reconciled rather than silently changing underfoot.

## 6.15 `alerts`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| session_id | UUID | FK → investigation_sessions NOT NULL | |
| title | TEXT | NOT NULL | |
| description | TEXT | NOT NULL | |
| severity | ENUM | NOT NULL | `informational`, `low`, `medium`, `high`, `critical` (§8.5) |
| status | ENUM | NOT NULL DEFAULT 'new' | `new`, `in_progress`, `resolved`, `dismissed` |
| dismissal_reason | TEXT | NULL | required when status → `dismissed` (§2.1) |
| primary_entity_type | ENUM | NOT NULL | `identity`, `device`, `mailbox` |
| primary_entity_id | UUID | NOT NULL | polymorphic |
| mitre_technique_id | UUID | FK → mitre_techniques NULL | |
| detection_rule_id | UUID | FK → detection_rules NULL | which rule fired (§8.1) |
| dedup_count | INTEGER | NOT NULL DEFAULT 1 | §8.7 |
| is_false_positive_by_design | BOOLEAN | NOT NULL DEFAULT false | internal-only, marks intentionally-noisy decoy alerts (§8.6) |
| first_seen_at / last_seen_at | TIMESTAMPTZ | NOT NULL | |

**`alert_evidence_refs`**: `alert_id` FK, `event_table` TEXT (which of the §6.12 tables), `event_id` UUID (polymorphic reference to the specific row) — this is what makes an alert's "show evidence" drill-down (§2.1) deterministic rather than a re-search.

**`detection_rules`**: `id`, `name`, `description`, `logic_summary` TEXT (human-readable, not an executable query language — §8.1), `default_severity`, `mitre_technique_id` FK, `is_active` BOOLEAN.

**`threat_intel_indicators`** (§2.7): `id`, `scenario_version_id` FK, `indicator_type` ENUM(`hash`,`ip`,`domain`,`url`), `value`, `reputation` ENUM, `actor_attribution` TEXT NULL, `context` TEXT.

## 6.16 `incidents`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| session_id | UUID | FK → investigation_sessions NOT NULL | |
| title | TEXT | NOT NULL | Student-authored |
| status | ENUM | NOT NULL DEFAULT 'open' | `open`, `investigating`, `contained`, `closed`, `reopened` (§2.3) |
| verdict | ENUM | NULL | `true_positive`, `false_positive`, `benign_positive` — set at closure |
| summary | TEXT | NULL | required at closure |
| closed_at | TIMESTAMPTZ | NULL | |
| created_at / updated_at | TIMESTAMPTZ | NOT NULL | |

**`incident_alerts`** (join): `incident_id` FK, `alert_id` FK, `linked_at` — supports §2.2's "build one incident from multiple alerts."
**`incident_techniques`** (join): `incident_id` FK, `mitre_technique_id` FK — the Student's own tagging, compared against `scenario_techniques` (§6.7) at scoring time.

## 6.17 `evidence_collection` and `analyst_notes`

**`evidence_collection`**: `id`, `incident_id` FK NOT NULL, `event_table` TEXT, `event_id` UUID (polymorphic, mirrors `alert_evidence_refs`), `justification` TEXT NOT NULL, `mitre_technique_id` FK NULL (Student's own tag), `pinned_by` FK→users, `pinned_at`.

**`analyst_notes`**: `id`, `incident_id` FK NOT NULL, `body` TEXT NOT NULL (constrained rich text, §2.13), `created_by` FK→users, `created_at`, `updated_at`.

## 6.18 `certificates`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | also serves as the public verification token (§2.18) |
| user_id | UUID | FK → users NOT NULL | |
| learning_path_id | UUID | FK → learning_paths NOT NULL | |
| issued_at | TIMESTAMPTZ | NOT NULL | |
| score_snapshot | JSONB | NOT NULL | denormalized summary of qualifying scores, so the certificate remains valid/renderable even if underlying session data is later archived per §6.23 |
| pdf_object_key | TEXT | NOT NULL | object storage reference (§5.11) |
| revoked_at | TIMESTAMPTZ | NULL | integrity mechanism if a certificate is later found to be issued in error |

Also, from the Learning Platform domain (§13): `courses`, `learning_paths`, `learning_path_scenarios` (join, ordered), `achievements`, `user_achievements`, `leaderboard_entries` (`user_id`, `period` ENUM(`weekly`,`monthly`,`all_time`), `points`, `rank` — recomputed by the scheduled rollup job, §5.12).

## 6.19 `refresh_tokens`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users NOT NULL | |
| token_hash | TEXT | UNIQUE NOT NULL | SHA-256 of the opaque token; plaintext never stored (§5.7) |
| device_label | TEXT | NULL | user-facing "which device" for the logout-one-device UI |
| issued_at | TIMESTAMPTZ | NOT NULL | |
| expires_at | TIMESTAMPTZ | NOT NULL | |
| revoked_at | TIMESTAMPTZ | NULL | set on rotation-detected-reuse (theft signal), explicit logout, or bulk revoke |
| replaced_by_token_id | UUID | FK → refresh_tokens NULL | rotation chain, enables reuse detection (§15.7) |

## 6.20 `instructor_feedback`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| incident_id | UUID | FK → incidents NOT NULL | |
| instructor_id | UUID | FK → users NOT NULL | |
| rubric_overrides | JSONB | NULL | per-item score adjustments, preserved distinctly from the original automated `scores` row (§2.15) |
| comment | TEXT | NULL | |
| reopened_session | BOOLEAN | NOT NULL DEFAULT false | |
| created_at | TIMESTAMPTZ | NOT NULL | |

Deliberately append-only and additive: an instructor's feedback never overwrites `scores`; the results UI (§2.12) displays both the automated score and any instructor feedback as distinct, attributed entries, preserving the pedagogical value of showing a Student both machine and human assessment.

## 6.21 Learning Platform Tables

Covered inline above (§6.18) alongside `certificates` since they share a domain and are small reference/join tables: `courses` (`id`, `title`, `description`, `career_track` ENUM(`soc_analyst`,`blue_team`)), `learning_paths` (`id`, `course_id` FK, `title`, `pass_threshold_percent`), `learning_path_scenarios` (`learning_path_id` FK, `scenario_id` FK, `sort_order`), `achievements` (`id`, `code`, `name`, `description`, `criteria` JSONB — e.g. "complete 5 ransomware scenarios with >90% score"), `user_achievements` (`user_id` FK, `achievement_id` FK, `earned_at`).

## 6.22 `audit_logs`

Platform-wide, security/compliance-relevant action log — distinct in *purpose* from `investigation_actions` (§6.13, which is pedagogical/replay data scoped to a scenario session) even though both are append-only event logs.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | UUID | PK | |
| actor_user_id | UUID | FK → users NULL | NULL for system-initiated actions |
| actor_ip | INET | NULL | |
| action | TEXT | NOT NULL | e.g. `login`, `login_failed`, `role_changed`, `password_reset`, `verdict_submitted`, `admin_impersonation_started`, `cohort_created`, `sso_config_changed` |
| target_type | TEXT | NULL | |
| target_id | UUID | NULL | |
| metadata | JSONB | NULL | |
| correlation_id | UUID | NULL | ties back to the originating API request (§5.2) |
| occurred_at | TIMESTAMPTZ | NOT NULL | |

`audit_logs` rows are **never updated or deleted** by application code (enforced by revoking `UPDATE`/`DELETE` grants on this table from the application's database role, leaving only `INSERT`/`SELECT` — a defense-in-depth measure against a compromised application server tampering with its own audit trail, §15.9).

## 6.23 Data Retention & Partitioning Strategy

**Retention:**
- `investigation_sessions` and all synthetic telemetry tables (§6.10–§6.12): retained in "hot" (immediately queryable) storage for **90 days** after `submitted_at`/`expires_at`, then the session's telemetry rows are exported as a compressed JSON bundle to object storage (`archived-sessions` bucket) and hard-deleted from Postgres. `scores`, `evidence_collection`, `analyst_notes`, and the incident's final report snapshot are **never archived-away** — they are small, permanently valuable records kept indefinitely (subject to account-deletion requests, §15.12). This split (bulky synthetic telemetry expires; compact scoring/report data persists forever) is what keeps the primary database's storage footprint proportional to *active* usage rather than all-time cumulative usage (§20).
- `audit_logs`: retained a minimum of **2 years**, aligned with common institutional compliance-training record-keeping expectations for the education/enterprise buyer segments (§1.3); never bulk-deleted by an automated job.
- `investigation_actions`: same 90-day hot-storage horizon as telemetry, archived alongside its session.

**Partitioning:** `security_events`-family tables (§6.12) and `audit_logs` are designed from MVP as **range-partitioned by month** on `occurred_at` (Postgres native declarative partitioning), even though MVP volume does not strictly require it (§3.3). This is specified up front — rather than retrofitted later — because: (1) partition-per-month makes the 90-day archival job in the previous paragraph a cheap `DETACH PARTITION` + export instead of a slow row-by-row `DELETE`, and (2) retrofitting partitioning onto a live, large table is a materially riskier migration than starting partitioned. New monthly partitions are created by the scheduled job in §5.12, one month ahead of need.

## 6.24 Migration Tooling & Change Management

All schema changes go through a versioned migration tool (e.g., Prisma Migrate, Knex, or Flyway — any tool satisfying the requirements below; not prescribed further since this is an implementation-detail choice, §5.1) under these rules: migrations are **forward-only** in production (a bad migration is fixed by a new forward migration, never by editing/rolling back an already-applied one, matching the git-commit philosophy in this document's operating instructions); every migration is reviewed and applied through CI/CD (§5.1), never run ad hoc against production; destructive migrations (column/table drops) require a two-step process — stop writing to/reading the column in application code and deploy that first, *then* drop the column in a subsequent migration at least one release later — so a rollback of the application code never references a already-dropped column.
