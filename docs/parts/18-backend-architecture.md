# 18. Backend Architecture

## 18.1 Service Inventory

Restating and detailing the domain services first introduced in §4.2, each a distinct code module (physically separate service at Scale, §4.6):

| Service | Owns tables (§6) | Responsibilities |
|---|---|---|
| Identity/Auth Service | users, organizations, cohorts, cohort_enrollments, refresh_tokens | Signup/login/SSO, RBAC data, org/cohort membership |
| Scenario & Content Service | attack_scenarios, scenario_versions, scenario_techniques, mitre_techniques, cohort_scenario_assignments | Catalog, authoring, versioning, publish validation (§12.6) |
| Session Service | investigation_sessions | Session lifecycle, orchestrates generation (§7) and scoring (§12.4) triggers |
| Telemetry Generator (worker) | identities, devices, all §6.12 event tables | Synthetic world/event generation (§7) |
| Alert Engine (worker) | alerts, alert_evidence_refs, detection_rules, threat_intel_indicators | Detection/correlation (§8) |
| Investigation Service | incidents, incident_alerts, incident_techniques, evidence_collection, analyst_notes, investigation_actions | Case management, evidence, notes, actions (§2.2–§2.10, §2.20) |
| Scoring Engine (worker) | scores, score_history | Automated grading (§12.4) |
| Identity/Device/Email Portal Services | (read-mostly views over §6.10–§6.12) | Investigation-surface read APIs (§9–§11) |
| Learning Platform Service | courses, learning_paths, achievements, certificates, leaderboard_entries | §13 |
| Instructor Service | instructor_feedback | §2.15, §16.13 |
| Admin Service | (cross-cutting reads + audit_logs writes) | §2.16 |
| Notification/Realtime Module | (no owned tables; Redis pub/sub, §5.10) | WebSocket fan-out |
| Reporting Worker | (reads across domains, writes to object storage) | PDF/CSV export (§2.19) |
| AI Gateway Service (Phase 3) | (no owned tables; logs prompt/response metadata) | §14 |

Each service exposes its functionality only via its public interface (in-process function calls at MVP, HTTP+internal-auth at Scale, §4.6) — **no service queries another service's tables directly**, even though they may be physically co-located in one Postgres instance at MVP; this is enforced by code-organization convention (each service's repository layer is package-private to that service) and checked by a lint rule scanning for cross-package table-client imports in CI.

## 18.2 Identity/Auth Service — Internal Workflow Example

`POST /auth/login` (§16.2) flow: validate request shape → look up `users` by email (constant-time comparison path not required here since email isn't a secret, but the subsequent password check uses argon2id's built-in constant-time verify) → on hash mismatch, increment the Redis-backed failed-attempt counter (§15.1) and write an `audit_logs` `login_failed` row → on success, check `mfa_status`; if MFA-enrolled, issue a short-lived MFA challenge token and return `202` pending MFA rather than tokens; if not, issue access+refresh tokens (§5.7), write `audit_logs` `login` row, update `last_login_at`, return `200`. Every branch — success, bad password, MFA-pending, locked-out — is a distinct, tested path, since auth is the highest-consequence code in the service.

## 18.3 Cross-Cutting: The Serialization/DTO Layer

Referenced repeatedly in §9.9/§10.12/§11.10/§12.3/§14.2/§15.6: every domain service that touches a table with a ground-truth or internally-sensitive column defines its Student-facing response DTOs as an explicit allow-list of fields (never "return the row minus a blocklist"), constructed by a shared `toStudentDTO()`-style mapping function per entity type, used uniformly by every endpoint that returns that entity type (list, detail, search-result, timeline-item, AI-assistant-context-builder, §14.2). A distinct, separately-authorized `toInstructorReviewDTO()`/`toAdminDTO()` mapping exists only for the specific endpoints in §2.15/§2.16 that legitimately need broader visibility, and even those never include the raw `ground_truth_definition` seed material outside a dedicated Platform-Admin-only debug endpoint used for scenario-authoring QA (§12.6).

## 18.4 Session Service — Orchestration Workflow

`POST /sessions` (§16.4): validate the requested `scenarioId`/`cohortAssignmentId` (attempt-limit check against `cohort_scenario_assignments`, §6.6) → create the `investigation_sessions` row with a freshly generated `seed` (§6.9) and `status = 'provisioning'` → check the pre-generated telemetry pool (§7.7) for the scenario's current version; if a bundle is available, bulk-load it (bulk `INSERT`s inside one transaction, remapping bundle-relative IDs to fresh UUIDs) and immediately set `status = 'active'`; if not, enqueue a `telemetry-generation` job (§5.9) and return `provisioning`, with the worker flipping status to `active` and emitting a `session.ready` WebSocket event on completion. `POST /sessions/{id}/submit` locks the session (`status = 'submitted'`, rejecting further evidence/note/action writes with `409`) and enqueues a `scoring` job chained to also trigger the achievements-evaluation step (§13.3) and, if the session is cohort-assigned, notifies the Instructor review queue (§16.13).

## 18.5 Learning Platform Service — Progress Computation

As established in §13.2, progress is computed on read, not stored: `GET /learning/paths/{id}` joins the caller's `investigation_sessions`+`scores` against `learning_path_scenarios` for the requested path, cached in Redis per `(userId, pathId)` with a short TTL and explicitly invalidated on session submission (§18.4's submit flow publishes a `progress:invalidate:{userId}` event the Learning Platform Service subscribes to) — a lightweight pub/sub-triggered cache invalidation rather than a cross-service database write, keeping the two services' data ownership boundaries (§18.1) clean.

## 18.6 Error Handling Strategy

- **Validation errors** (`400`) are raised at the API Gateway edge (§5.2) wherever possible, before any service code runs, using the same schema as the OpenAPI contract (§16.1) — a single source of truth for "what does a valid request look like," rather than duplicated validation logic per service.
- **Business-rule errors** (`409` conflicts like `INSUFFICIENT_EVIDENCE`, §16.6) are raised by domain services as typed exceptions caught by a shared error-mapping middleware that converts them to the standard error envelope (§16.1) — services throw domain-meaningful exceptions (`InsufficientEvidenceError`), never construct HTTP responses directly, keeping business logic testable independent of the HTTP layer.
- **Unexpected errors** (`500`) are caught by the same middleware, logged with full stack trace + correlation ID server-side, and returned to the client as a generic message with only the correlation ID exposed (never a stack trace or internal detail) — support/debugging uses the correlation ID to find the full server-side log entry (§3.9).
- **Background job failures** (§5.9): BullMQ's built-in retry-with-backoff (default 3 attempts, exponential backoff) handles transient failures (a momentary DB connection blip); a job that exhausts retries moves to a dead-letter queue with alerting (§3.10) rather than being silently dropped, since a permanently-failed `telemetry-generation` job means a Student is stuck on a `provisioning` session and needs either automatic recovery (retry from a pre-generated bundle fallback, §7.7) or a visible, honest error state in the UI rather than an infinite spinner.

## 18.7 Scheduling and Scaling Strategy Per Service

- **Stateless request-path services** (Identity/Auth, Scenario/Content, Session, Investigation, all three Portal services, Learning Platform, Instructor, Admin) scale horizontally by adding replicas behind the load balancer (§5.15) — no service holds in-memory state that would break under multiple replicas, since all session/cache state lives in Redis/Postgres (§5.6), which is precisely why this constraint was established early in §3.3.
- **Worker services** (Telemetry Generator, Alert Engine, Scoring Engine, Reporting) scale horizontally by adding BullMQ worker processes consuming from their named queues (§5.9); concurrency-per-worker is capped per queue based on the resource profile of that job type (telemetry generation is CPU-heavy and capped low per worker at MVP's shared-VPS resource ceiling; email/reporting jobs are I/O-bound and can run at higher concurrency per worker).
- **Realtime/Notification module** scales horizontally because Redis pub/sub (§5.10), not in-process broadcast, is the fan-out mechanism — any replica can deliver a message to any locally-connected socket regardless of which replica received the originating publish.
- The Scale-phase migration (§19.4) applies Kubernetes Horizontal Pod Autoscaling to each of these independently, using CPU utilization for the Telemetry Generator worker pool specifically (its bottleneck, §7.4) and request-latency/queue-depth-based custom metrics for the request-path services and the other worker pools respectively — i.e., the autoscaling *signal* is chosen per service to match its actual bottleneck, not a single blanket CPU-percentage rule applied uniformly.
