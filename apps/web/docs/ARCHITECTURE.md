# SOCVerse — Platform Architecture

**Product:** SOCVerse (shipping name: ClickBox Console)
**Repository:** `clickboxhq/clickbox-soc-product`
**Status:** Living document — describes the target production architecture and the state of the existing prototype it formalizes.
**Audience:** Engineering, security content design, and founders evaluating build cost.

> **Note on the existing codebase.** This is not a greenfield spec. The repo already contains a working TanStack Start (React 19) frontend with ~30 console routes (`src/routes/app.*.tsx`), a Zustand store (`src/lib/store.ts`) that implements a real evidence-pinning, MITRE-tagging, and rubric-based **scoring engine** against per-incident "ground truth" (`src/lib/case-data.ts`), and a seeded dataset of alerts, incidents, identities, and endpoints (`src/lib/soc-data.ts`). Today all of this runs **entirely client-side** — there is no server, no database, no multi-user state, and "persistence" is `localStorage`. This document's job is to describe the backend, data model, and services needed to turn that client-side prototype into a real multi-tenant product, while keeping the frontend's existing investigation UX and scoring logic largely intact (ported server-side, not rebuilt).

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Functional Requirements](#2-functional-requirements)
3. [Non-Functional Requirements](#3-non-functional-requirements)
4. [Complete System Architecture](#4-complete-system-architecture)
5. [Infrastructure Design](#5-infrastructure-design)
6. [Database Design](#6-database-design)
7. [Telemetry Generator](#7-telemetry-generator)
8. [Alert Engine](#8-alert-engine)
9. [Identity Investigation Service](#9-identity-investigation-service)
10. [Device Investigation Service](#10-device-investigation-service)
11. [Email Investigation Module](#11-email-investigation-module)
12. [Scenario Engine](#12-scenario-engine)
13. [Learning Platform](#13-learning-platform)
14. [AI Features](#14-ai-features)
15. [Security Architecture](#15-security-architecture)
16. [API Specification](#16-api-specification)
17. [Frontend Architecture](#17-frontend-architecture)
18. [Backend Architecture](#18-backend-architecture)
19. [Deployment Strategy](#19-deployment-strategy)
20. [Cost Optimization](#20-cost-optimization)

---

## 1. Executive Summary

### Product vision

SOCVerse is a proprietary, cloud-based **SOC investigation simulator**. It is not a SIEM, not a log-ingestion product, and not built on top of one. It generates its own realistic security telemetry — sign-ins, process trees, emails, DNS queries, cloud audit events — assembles that telemetry into deliberately-crafted attack scenarios, and puts a learner in front of an investigation console that looks and behaves like the tools they'll use on the job (Sentinel-, Defender-, and Chronicle-adjacent, never a clone of any of them). The platform holds the "ground truth" of every scenario in the backend and grades the learner's investigation — not just their final answer — against it: which evidence they pinned, which they missed, which MITRE techniques they correctly identified, which response actions they took, and how many hints they burned getting there.

### Market opportunity

SOC analyst training today is split between two poor options: (1) passive, video-based courses that teach terminology but never put a learner inside a real console, and (2) full cyber ranges (e.g., Hack The Box-style, or actual SIEM sandboxes) that are expensive to operate, hard to author content for, and built for offense (CTF) rather than the specific discipline of triage-and-investigate. There is no dedicated, affordably-priced, subscription SaaS product whose entire purpose is "learn to be a SOC analyst by doing the actual job, gradable, with a real console." Universities, bootcamps, and internal L&D teams at MSSPs are the immediate buyers; individual subscribers preparing for SOC-analyst interviews are the long-tail.

### Why the platform exists

Existing SIEMs are wrong for this job for three reasons: they're built to ingest real customer data (a massive, unnecessary cost and liability for a training product), their UX is optimized for power users who already know the product, and none of them grade an investigation — they log actions, they don't score correctness against a hidden truth. SOCVerse is purpose-built around the one thing training actually requires: a scenario with a known-correct answer, and a console good enough that the skills transfer.

### Target users

- **Individual learners** — students and career-switchers building a portfolio and a SOC Analyst Career Track certificate.
- **Bootcamps and universities** — cohort-based delivery, instructor dashboards, grading at scale (this repo's own ClickBox Internship is itself a first customer).
- **Enterprise / MSSP L&D teams** — onboarding new Tier-1 analysts against organization-specific-flavored scenarios before they touch production tooling.

### Future commercial vision

Per-seat subscription SaaS with three tiers mirroring the existing marketing site's Professional/Enterprise split (see `src/components/soc/marketing/*`): **Individual** (self-serve, monthly), **Cohort** (per-seat, instructor tooling, LMS-style progress export), **Enterprise** (SSO/SAML, custom scenario authoring, dedicated tenancy options, audit export for compliance). Certificates (already scaffolded at `app.certificates.tsx`) are a natural upsell and a distribution channel — every completer becomes a LinkedIn impression for the platform.

---

## 2. Functional Requirements

Grounded in the routes already scaffolded in `src/routes/`. Each existing route is noted; routes not yet built are marked **(new)**.

| Capability | Existing route | Description |
|---|---|---|
| **Alert Dashboard** | `app.alerts.tsx` | Live-feeling stream of generated alerts: severity, status, source, assigned analyst, MITRE tag. Filter/sort/bulk-triage. |
| **Incident Queue** | `app.incidents.tsx` | Alerts promoted (manually or auto-correlated) into incidents; entity/alert counts, owner, SLA clock. |
| **Case Management** | `app.cases.index.tsx`, `app.cases.$id.tsx` | The investigation workspace: status, verdict, evidence pinning with justification, MITRE tagging, timeline building, analyst notes, response-action log, hint usage, submission → scoring. This is the core learning loop. |
| **Investigation workspace (alt view)** | `app.investigations.index.tsx`, `app.investigations.$id.tsx` | Case view scoped to a specific incident/scenario session; will consolidate with Case Management server-side (see §17). |
| **Identity Portal** | `app.identity.tsx` | Entra ID-inspired identity investigation surface — see §9. |
| **Device Portal** | `app.endpoints.tsx` | Defender-inspired endpoint investigation surface — see §10. |
| **Email Portal** | `app.email.tsx` | Outlook-inspired phishing investigation surface — see §11. |
| **Threat Intelligence** | `app.threat-intel.tsx` | Indicator lookups (`case-data.ts` → `threatIndicators`), actor/campaign correlation, deliberately-seeded decoy indicators so keyword search alone can't solve a scenario. |
| **Global Search** | `app.search.tsx` | Cross-entity query (KQL-flavored, see §16) across alerts, identities, devices, indicators. |
| **Global Timeline** | `app.timeline.tsx` | Chronological, cross-source event reconstruction; feeds from `globalTimeline` today, will read the `security_events` table server-side. |
| **MITRE ATT&CK Explorer** | `app.mitre.tsx` | Technique catalog + which techniques appear in which active/completed scenarios. |
| **Evidence Collection** | `app.evidence.tsx` | Pinned-evidence review, chain-of-custody style listing per case. |
| **Scenario Library** | `app.scenarios.tsx` | Catalog of investigable scenarios, difficulty, estimated time, completion state. |
| **Scenario Completion & Scoring** | store: `scoreCase()` | Rubric: technique accuracy (30%), evidence recall (25%), evidence precision (15%), required response actions (15%), correct verdict (15%), minus hint penalty. See §12.4. |
| **Instructor Mode** | `app.instructor.tsx` | Cohort roster, per-learner progress, reopen-with-feedback flow (`reopenCase`), score overrides. |
| **Scenario Builder** | `app.scenario-builder.tsx` | Authoring tool for new scenarios — entities, seeded events, ground truth, required actions. See §12.1. |
| **Cohorts** | `app.cohorts.tsx` | Group learners under an instructor/organization; assignment of scenario sets and deadlines. |
| **Organizations** | `app.organizations.tsx` | Enterprise/MSSP tenant management — **(new, backend-only today)**. |
| **Admin Portal** | `app.settings.tsx`, `app.organizations.tsx`, `app.audit-logs.tsx` | Tenant, user, role, and platform configuration. |
| **Analytics** | `app.analytics.tsx`, `app.student-analytics.tsx` | Aggregate performance: MTTR-equivalent, technique mastery heatmap, cohort comparison. |
| **Reporting** | `app.reports.tsx` | Exportable investigation reports (per case and per learner), instructor-facing cohort reports. |
| **Achievements / Leaderboard** | `app.achievements.tsx`, `app.leaderboard.tsx` | Gamification layer — badges, cohort and global rankings. |
| **Learning Paths** | `app.learning.tsx` | Structured course/lab sequencing — SOC Analyst and Blue Team tracks. See §13. |
| **Certificates** | `app.certificates.tsx`, `verify.$id.tsx` | Issued on track completion; public verification page already scaffolded at `/verify/$id`. |
| **Assessments** | `app.assessments.tsx` | Pre/post knowledge checks distinct from scenario-based scoring. |
| **Feedback** | `app.feedback.tsx` | Learner feedback capture per scenario/course. |
| **Audit Logs** | `app.audit-logs.tsx` | Tamper-evident log of every write action platform-wide — see §15. |
| **Billing** | `app.billing.tsx` | Subscription management — **(new, needs Stripe integration)**. |
| **Profile / Settings** | `app.profile.tsx`, `app.settings.tsx` | Account, org, and platform preferences. |
| **Command Palette** | `command-palette.tsx` | Cmd-K style navigation, already built. |

---

## 3. Non-Functional Requirements

| Category | Target | Notes |
|---|---|---|
| **Performance** | p95 API response < 300ms for reads, < 800ms for writes (evidence pin, note add); console TTI < 2.5s on cable connection | Achieved via Redis-cached read paths for hot entities (alerts, active case state) and route-level code-splitting (already in place — TanStack Router is file-route-split by default). |
| **Availability** | 99.5% MVP (single VPS, acceptable for an education product not yet under SLA), 99.9% target once on managed infra with a standby | No investigation state is lost on a restart — case state persists to Postgres on every mutation (debounced client-side, immediate server-side). |
| **Scalability** | 10k concurrent learners at Series-A scale without architecture change | Stateless API layer behind a load balancer; the only stateful pieces (Postgres, Redis, MinIO/R2) scale vertically first, then via managed read replicas / Redis Cluster. |
| **Latency** | Telemetry generation for a new scenario session < 3s; scoring computation < 500ms | Both are pure CPU/DB work, no external calls — deterministic and fast by design (see §7, §12.4). |
| **Security** | See §15 in full | RBAC, tenant isolation at the query layer, audit logging on all mutating actions, encrypted secrets, no scenario ground-truth ever shipped to the client. |
| **Cloud architecture** | Portable — no proprietary managed service that can't be replaced (see §20) | Postgres, Redis, and S3-compatible storage are the only hard dependencies; every managed equivalent (RDS, ElastiCache, R2/S3) is a drop-in swap for the self-hosted VPS equivalent. |
| **Maintainability** | One monorepo, one deploy artifact per service, typed end-to-end (TypeScript + Zod + typed API client) | See §18 for service boundaries; §16 for the typed contract between them. |
| **Reliability** | No single scenario/session write can corrupt another learner's state | Every mutation is scoped by `(session_id, user_id)` with row-level checks; the scoring function is pure and idempotent — re-running it produces the same result. |
| **Logging** | Structured JSON logs, one line per request, correlation ID threaded from edge to DB query | Pino (Node) → stdout → collected by the host (see §5). |
| **Monitoring** | Uptime, error rate, p95 latency, queue depth, DB connection saturation | See §5 (Grafana + Prometheus stack, self-hosted, zero license cost). |
| **Disaster recovery** | RPO ≤ 24h at MVP (nightly `pg_dump` to object storage), RPO ≤ 5min once WAL-archiving is enabled on managed Postgres | RTO target: < 1h at MVP (restore dump to a fresh VPS), < 15min on managed infra (point-in-time restore). |

---

## 4. Complete System Architecture

### 4.1 High-level flow

```
┌─────────────┐
│   Browser   │  React 19 SPA/SSR (TanStack Start), WebSocket client
└──────┬──────┘
       │ HTTPS (REST + WS)
┌──────▼──────┐
│    Nginx    │  TLS termination, reverse proxy, static asset cache
│ (LB @ scale)│
└──────┬──────┘
       │
┌──────▼──────────────────────────────────────────────────────────┐
│                        API Gateway / BFF                         │
│   TanStack Start server routes (Nitro) — auth check, rate limit, │
│   request validation (Zod), tenant resolution, routing to        │
│   internal services                                               │
└──────┬─────────────────────────────────────────────────────────┬─┘
       │                                                          │
┌──────▼─────────┐  ┌─────────────────┐  ┌───────────────────┐  ┌▼──────────────┐
│  Core API       │  │  Telemetry       │  │  Scoring Engine    │  │  Realtime      │
│  Service        │  │  Generator       │  │  Service           │  │  Gateway (WS)  │
│  (users, cases, │  │  (scenario seed, │  │  (rubric scoring,  │  │  (alert feed,  │
│  alerts, notes) │  │  synthetic logs) │  │  ground-truth diff)│  │  live timeline)│
└──────┬──────────┘  └────────┬─────────┘  └─────────┬──────────┘  └───────┬────────┘
       │                      │                       │                      │
       │              ┌───────▼───────┐               │              ┌───────▼──────┐
       │              │  Job Queue     │◄──────────────┘              │  Redis Pub/Sub│
       │              │  (BullMQ/Redis)│                              └───────────────┘
       │              └───────┬───────┘
       │                      │ background workers
       │              ┌───────▼───────────────────────┐
       │              │  Workers: scenario materialize, │
       │              │  scheduled resets, report gen,   │
       │              │  email send, certificate render  │
       │              └───────┬───────────────────────┘
       │                      │
┌──────▼──────────────────────▼─────────────────────────┐   ┌──────────────────┐
│                   PostgreSQL (primary)                  │   │  Object Storage   │
│  users, orgs, cases, security_events, scenarios,         │   │  (MinIO → R2/S3)  │
│  scores, audit_logs, certificates, ... (§6)              │   │  attachments,      │
└───────────────────────────────────────────────────────┘   │  cert PDFs, exports│
                                                               └──────────────────┘
```

### 4.2 Component responsibilities

- **Frontend** — TanStack Start app. Renders the console, holds ephemeral UI state locally (Zustand, no longer the source of truth for case data once the backend exists — see §17), talks to the API Gateway over REST for CRUD and over WebSocket for the live alert feed / timeline.
- **API Gateway / BFF** — Same Nitro server that renders the app (TanStack Start ships a full Node/edge server, not just a static build). Owns session verification, per-tenant scoping, request validation, and dispatches to internal services. At MVP scale this *is* the backend — see §18 for why we don't split into real microservices until there's a reason to.
- **Core API Service** — CRUD for users, organizations, cases, alerts, incidents, notes, evidence, timeline entries. The thing most REST endpoints in §16 hit.
- **Telemetry Generator** — Deterministic, seed-driven synthetic log generator (§7). Runs at scenario-session start (materializes a scenario instance for a specific learner) and can run continuously for "live feed" scenarios.
- **Alert Engine** — Detection-rule evaluation over generated telemetry, producing the alerts a learner sees (§8). Runs as part of scenario materialization, not as a separate always-on process at MVP scale.
- **Scoring Engine Service** — Ports the existing `scoreCase()` logic (`src/lib/store.ts`) server-side, run against the DB-stored ground truth instead of a client-side import, so it can never be inspected or tampered with from the browser (§12.4, §15).
- **Realtime Gateway** — WebSocket layer (Nitro's built-in `crossws` support) for the live alert stream, collaborative-timeline updates (multiple learners on a team scenario), and instructor "watch mode."
- **Job Queue + Workers** — BullMQ on Redis. Scenario materialization, scheduled scenario resets, PDF/certificate rendering, report generation, and outbound email are all queued jobs, not inline request work — keeps API p95 low (§3).
- **PostgreSQL** — System of record for everything (§6).
- **Object Storage** — Scenario attachments (the actual `.eml` files, PCAP-flavored artifacts, sandboxed-attachment renders), generated certificate PDFs, exported reports.

---

## 5. Infrastructure Design

| Layer | MVP (single VPS) | At scale |
|---|---|---|
| **Frontend** | Served by the same Nitro process (SSR + static assets) behind Nginx | CDN in front (Cloudflare) caching static assets and SSR'd marketing pages; app shell stays dynamic |
| **Backend** | Node process (Nitro server) via `pm2` or `systemd`, single instance | Multiple stateless instances behind the load balancer, autoscaled on CPU/connection count |
| **API layer** | Same process as frontend (TanStack Start server routes) | Same — no reason to split into a separate API process; split into real services only if a specific one (e.g., telemetry generation) becomes a scaling bottleneck |
| **Database** | PostgreSQL 16 in a Docker container on the VPS, daily `pg_dump` to object storage | Managed Postgres (RDS / Neon / Supabase) with read replica, PITR enabled |
| **Caching** | Redis 7 in Docker (also backs BullMQ) | Managed Redis (ElastiCache / Upstash) or Redis Cluster |
| **Auth** | Self-issued JWT (access + refresh), argon2id password hashing | Same, + SSO/SAML via WorkOS for Enterprise tier (§15) |
| **Authorization** | RBAC middleware, tenant-scoped queries (§15) | Same, unchanged by scale |
| **Containerization** | Docker Compose — one `docker-compose.yml`: app, postgres, redis, minio, nginx | Same images, deployed via Kubernetes or a managed container platform |
| **Kubernetes readiness** | Not used at MVP, but every service is already a stateless container with env-var config and a health-check endpoint — zero rework to write k8s manifests later | Helm chart wrapping the same images |
| **Object storage** | MinIO (S3 API-compatible), Docker container on the VPS | Cloudflare R2 (S3-compatible API, zero egress fees) — literally an endpoint/credential swap, no code change |
| **Message queue** | BullMQ on the same Redis instance | Same, or graduate to Redis Cluster / a managed queue if job volume demands it |
| **Background workers** | Same Node process, a `worker` entry point run as a second `pm2` process | Separate worker deployment, scaled independently from the API |
| **Scheduled jobs** | `node-cron` inside the worker process (nightly backups, scenario resets, digest emails) | Same, or a managed cron trigger (e.g., a scheduled container run) if reliability needs a heartbeat/alerting layer |
| **WebSockets** | Nitro's built-in WS support (`crossws`), single instance, in-process pub/sub | Redis pub/sub fan-out across instances so any instance can push to any connected client |
| **Deployment** | `git push` → CI builds Docker image → SSH deploy + `docker compose up -d` | CI/CD to a container registry → rolling deploy on the target platform |
| **CDN** | None at MVP (Nginx serves static assets directly — traffic is low) | Cloudflare in front of Nginx/LB |
| **Load balancer** | None at MVP (single instance) | Nginx or a managed LB in front of multiple app instances |
| **Monitoring** | Prometheus + Grafana in Docker, scraping Node's `/metrics` and Postgres/Redis exporters | Same stack, or a managed equivalent (Grafana Cloud free tier) if self-hosting monitoring becomes its own maintenance burden |
| **Logging** | Pino → stdout → `docker logs` / a local file, rotated | Shipped to a log aggregator (self-hosted Loki, pairs with the existing Grafana) |
| **Secrets management** | `.env` file, `chmod 600`, never committed (already `.gitignore`'d in this repo) | A real secrets manager (Doppler free tier, or cloud provider's native one) once more than one person needs access |
| **Environment variables** | See §19 for the full list | Same, injected via the deploy platform's secret store instead of a file |

---

## 6. Database Design

PostgreSQL 16. All tables are tenant-scoped via `organization_id` except platform-global tables (`mitre_techniques`, `threat_indicators` template library). Every table has `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at`, `updated_at` unless noted. Soft-delete via `deleted_at NULLABLE` on user-facing entities so audit trails and analytics never lose history.

### 6.1 Identity & tenancy

**`organizations`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | text | |
| `slug` | text unique | subdomain/URL-safe identifier |
| `plan` | enum(`individual`,`cohort`,`enterprise`) | drives feature flags |
| `sso_enabled` | boolean | |
| `sso_config` | jsonb | SAML/OIDC metadata, encrypted at rest via app-layer encryption, not just disk encryption |
| `data_residency` | enum(`us`,`eu`,`other`) | informs which DB region a tenant's rows should live in once we shard by region |
| `billing_customer_id` | text | Stripe customer ID |

**`users`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `organization_id` | uuid FK → organizations, nullable | null for individual (non-org) subscribers |
| `email` | citext unique | |
| `password_hash` | text nullable | null if SSO-only |
| `full_name` | text | |
| `avatar_url` | text nullable | |
| `mfa_secret` | text nullable, encrypted | TOTP secret |
| `mfa_enabled` | boolean default false | |
| `last_login_at` | timestamptz | |
| `status` | enum(`active`,`invited`,`suspended`) | |

**`roles`** (seeded, not user-editable)
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | `student`, `instructor`, `org_admin`, `platform_admin` |
| `description` | text | |

**`user_roles`** — join table, `(user_id, organization_id, role_id)`, unique composite — a user can hold different roles per org (an instructor in one cohort org can be a student in another).

**`cohorts`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `organization_id` | uuid FK | |
| `name` | text | |
| `instructor_id` | uuid FK → users | |
| `starts_at` / `ends_at` | timestamptz | |

**`cohort_members`** — `(cohort_id, user_id)` composite PK.

### 6.2 Scenario authoring & catalog

**`scenarios`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text unique | e.g. `bec-finance-consent-phish` |
| `title` | text | |
| `category` | enum | `identity`,`endpoint`,`email`,`cloud`,`insider`,`web`,`malware`,`ransomware` (§ Main Goals) |
| `difficulty` | enum(`beginner`,`intermediate`,`advanced`,`expert`) | |
| `estimated_minutes` | int | |
| `status` | enum(`draft`,`published`,`archived`) | |
| `version` | int default 1 | incremented on republish — see §12.6 |
| `author_id` | uuid FK → users | |
| `mitre_technique_ids` | text[] | denormalized for fast catalog filtering |
| `intro_briefing` | text | shown to the learner before they start |

**`scenario_entities`** — the cast of a scenario: which identities/devices/mailboxes exist in it.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `scenario_id` | uuid FK | |
| `entity_type` | enum(`identity`,`device`,`mailbox`,`cloud_resource`) | |
| `entity_key` | text | stable reference used by generators/ground truth, e.g. `sarah.chen@contoso.com` |
| `attributes` | jsonb | department, role, risk baseline, OS, etc. — see §9/§10 field lists |

**`scenario_event_templates`** — the generator's instructions, not raw events (raw events are materialized per-session into `security_events`).
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `scenario_id` | uuid FK | |
| `sequence` | int | ordering / relative-time offset in minutes |
| `event_type` | text | e.g. `entra_signin`, `edr_process`, `email_delivered` (§7) |
| `entity_key` | text | which `scenario_entities.entity_key` this event belongs to |
| `template` | jsonb | field templates + randomization ranges, see §7.2 |
| `is_ground_truth` | boolean | true if this event is required evidence for a correct investigation |
| `mitre_technique_id` | text nullable FK → mitre_techniques | |
| `is_decoy` | boolean default false | benign look-alike noise, deliberately seeded (already a pattern in `case-data.ts`) |

**`scenario_ground_truth`** — the answer key. **Never sent to the client.**
| Column | Type | Notes |
|---|---|---|
| `scenario_id` | uuid PK/FK | one row per scenario |
| `verdict` | enum(`true-positive`,`false-positive`,`benign-positive`) | |
| `required_evidence_event_template_ids` | uuid[] | which templated events must be pinned |
| `required_technique_ids` | text[] | |
| `required_action_ids` | text[] | e.g. `revoke-session`, `isolate-host`, `purge-forwarding-rule` |
| `narrative_summary` | text | model-answer summary, shown post-submission |

**`mitre_techniques`** (platform-global, seeded from the public ATT&CK dataset)
| Column | Type |
|---|---|
| `id` | text PK (`T1078`, `T1110.003`, ...) |
| `name` | text |
| `tactic` | text |
| `description` | text |
| `url` | text |

**`response_actions`** (platform-global catalog)
| Column | Type | Notes |
|---|---|---|
| `id` | text PK | `revoke-session`, `isolate-host`, ... |
| `label` | text | |
| `applies_to` | enum(`identity`,`device`,`email`,`cloud`) | |

### 6.3 Runtime investigation state

**`investigation_sessions`** — one row per (learner, scenario) attempt. This is the server-side source of truth that today lives only in `useSoc().cases[id]` in `localStorage`.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `scenario_id` | uuid FK | |
| `scenario_version` | int | pinned at session start — a scenario republish never changes an in-flight session (§12.6) |
| `user_id` | uuid FK | |
| `organization_id` | uuid FK | |
| `cohort_id` | uuid FK nullable | |
| `status` | enum(`open`,`investigating`,`contained`,`closed`,`reopened`) | mirrors existing `CaseStatus` |
| `verdict` | enum(`true-positive`,`false-positive`,`benign-positive`) nullable | learner's submitted verdict |
| `summary` | text | learner's written summary |
| `technique_tags` | text[] | learner-selected MITRE techniques |
| `hints_used` | int default 0 | |
| `started_at` | timestamptz | |
| `submitted_at` | timestamptz nullable | |

**`security_events`** — the materialized telemetry for a session (generated from `scenario_event_templates` at session start — see §7).
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK → investigation_sessions | |
| `event_template_id` | uuid FK nullable | traceable back to the authored template |
| `ts` | timestamptz | materialized (template offsets resolved to real timestamps) |
| `source` | text | `Entra ID`, `Endpoint EDR`, `Email Gateway`, ... |
| `event_type` | text | |
| `entity_key` | text | |
| `entity_type` | enum | |
| `detail` | jsonb | full structured payload — see §7.1 per-source schemas |
| `severity` | enum(`critical`,`high`,`medium`,`low`,`info`) | |
| `mitre_technique_id` | text nullable | |
| `correlation_id` | uuid nullable | links events the Alert Engine correlated together |
| **Indexes** | | `(session_id, ts)`, `(session_id, entity_key)`, `(session_id, event_type)` — every investigation query filters by session first |

**`alerts`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | human-facing code `ALT-24817` generated separately, stored in `display_id` |
| `display_id` | text | |
| `session_id` | uuid FK | |
| `rule_id` | text FK → detection_rules | |
| `name` | text | |
| `severity` | enum | |
| `status` | enum(`new`,`open`,`in-progress`,`escalated`,`resolved`,`closed`) | |
| `assigned_user_id` | uuid FK nullable | |
| `source_event_ids` | uuid[] | which `security_events` triggered it |
| `mitre_technique_id` | text nullable | |
| `dismiss_reason` | text nullable | |

**`incidents`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | display id `INC-4821` |
| `session_id` | uuid FK | |
| `title` | text | |
| `severity` | enum | |
| `status` | enum | |
| `owner_user_id` | uuid FK nullable | |

**`incident_alerts`** — `(incident_id, alert_id)` join table (many-to-many; an alert can be promoted into an incident).

**`evidence_items`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK | |
| `security_event_id` | uuid FK | |
| `justification` | text | learner's stated reasoning — scored for quality in a future rubric revision (§14) |
| `technique_id` | text nullable | |
| `pinned_at` | timestamptz | |

**`timeline_entries`** — `(session_id, security_event_id, added_at)` — the learner-curated subset of events used to build the incident narrative.

**`notes`** — polymorphic, `entity_type enum(session,alert,incident)`, `entity_id uuid`, `author_id`, `body text`, `created_at`.

**`action_log`** — every response action a learner took.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK | |
| `action_id` | text FK → response_actions | |
| `target_entity_key` | text | |
| `actor_id` | uuid FK | |
| `reason` | text nullable | |
| `ts` | timestamptz | |

### 6.4 Scoring & feedback

**`scores`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK unique | one score per session (resubmission overwrites, prior kept in `score_history`) |
| `total` | int | 0–100 |
| `technique_accuracy` | int | |
| `evidence_precision` | int | |
| `evidence_recall` | int | |
| `false_positive_rate` | int | |
| `response_actions_pct` | int | |
| `hint_penalty` | int | |
| `verdict_correct` | boolean | |
| `missed_evidence_event_ids` | uuid[] | |
| `noise_included_event_ids` | uuid[] | |
| `missed_technique_ids` | text[] | |
| `scored_at` | timestamptz | |

**`score_history`** — append-only copy of every `scores` row on resubmission, for analytics on learner improvement over attempts.

**`instructor_feedback`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK | |
| `instructor_id` | uuid FK | |
| `body` | text | |
| `score_adjustment` | int | |
| `created_at` | timestamptz | |

### 6.5 Email investigation domain

**`email_messages`** — materialized per session for email-category scenarios.
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `session_id` | uuid FK | |
| `security_event_id` | uuid FK | the "delivered" event this message corresponds to |
| `headers` | jsonb | full header set incl. `Received` chain |
| `spf` | enum(`pass`,`fail`,`softfail`,`none`) | |
| `dkim` | enum(`pass`,`fail`,`none`) | |
| `dmarc` | enum(`pass`,`fail`,`none`) | |
| `subject`, `from_addr`, `to_addr` | text | |
| `body_html` | text | rendered in a sandboxed iframe client-side, never `dangerouslySetInnerHTML` without sanitization (§15.9) |
| `attachments` | jsonb | filename, sha256, sandbox verdict, storage key |
| `urls` | jsonb | extracted URLs + reputation verdict |
| `campaign_id` | uuid nullable FK → threat_campaigns | |

**`threat_indicators`** (platform-global template library, cloned into session-scoped rows at materialization so a learner's queries never leak into another session)
| Column | Type |
|---|---|
| `id` | uuid PK |
| `value` | text |
| `type` | enum(`sha256`,`ip`,`domain`,`url`) |
| `reputation` | enum(`malicious`,`suspicious`,`unknown`,`known-good`) |
| `actor`, `campaign` | text nullable |
| `first_seen` | date |
| `context` | text |
| `is_decoy` | boolean |

**`threat_campaigns`** — `id`, `name`, `actor`, `description`.

### 6.6 Certificates & audit

**`certificates`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | also the public verification code |
| `user_id` | uuid FK | |
| `learning_path_id` | uuid FK | |
| `issued_at` | timestamptz | |
| `pdf_storage_key` | text | object storage path |
| `revoked` | boolean default false | |

**`audit_logs`** — append-only, never updated or deleted (§15.10).
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `organization_id` | uuid nullable | |
| `actor_id` | uuid nullable | null for system actions |
| `action` | text | `session.submit`, `evidence.pin`, `user.role_change`, ... |
| `target_type`, `target_id` | text | |
| `metadata` | jsonb | |
| `ip_address` | inet | |
| `ts` | timestamptz | |
| **Integrity** | | hash-chained: each row's `metadata` includes `prev_hash`, making retroactive tampering detectable — see §15.10 |

### 6.7 Retention, partitioning, normalization

- **`security_events` and `audit_logs`** are the two high-volume tables. Both are **partitioned by month** (native Postgres declarative partitioning) so old partitions can be dropped or archived to object storage cheaply instead of `DELETE`-scanning a huge table.
- **Retention:** completed `investigation_sessions` and their `security_events` are retained 24 months (long enough for a learner's transcript/portfolio use), then the session row moves to a `sessions_archive` table (summary only — score, verdict, dates) and its `security_events` partition is exported to object storage as compressed JSON and dropped from Postgres.
- **`audit_logs`** are retained indefinitely (compliance requirement for Enterprise tier) but partitions older than 12 months move to cheaper storage (a read-only Postgres replica or exported Parquet in object storage queryable via DuckDB if audit analytics are ever needed).
- **Normalization:** the schema is in 3NF for all transactional tables. `security_events.detail` and `scenario_event_templates.template` are deliberately `jsonb` (denormalized) because their shape genuinely varies by `event_type` (§7.1) — modeling 15 event sources as 15 separate tables would add join complexity with no query-pattern benefit, since events are always read scoped to a single session, never joined across sources at the SQL level (correlation happens in application code, see §8).
- **Indexes** beyond primary/foreign keys: `alerts(session_id, status)`, `investigation_sessions(user_id, status)`, `scores(session_id)` unique, `certificates(id)` (verification is a hot, unauthenticated read path — see §16.12), `audit_logs(organization_id, ts)`.

---

## 7. Telemetry Generator

### 7.1 Supported synthetic sources

Each source has a fixed JSON shape stored in `security_events.detail`, modeled after the real product's actual event schema (field names match what a learner will see in a real tool later) without depending on that tool:

| Source | `event_type` examples | Key fields modeled after |
|---|---|---|
| Windows Security/Sysmon | `sysmon_process_create`, `sysmon_network_connect`, `winlog_4624`, `winlog_4688` | Process GUID/parent, hashes, command line, logon type |
| Linux (auth/syslog) | `linux_ssh_auth`, `linux_sudo`, `linux_cron_job` | PAM result, source IP, TTY |
| Microsoft 365 sign-ins | `m365_signin`, `m365_oauth_consent` | app ID, client app, conditional access result |
| Azure/Entra sign-ins | `entra_signin`, `entra_risk_detection` | risk level, location, IP, device trust |
| Email | `email_delivered`, `email_rule_created`, `email_forward_added` | SPF/DKIM/DMARC, rule action |
| Defender-style EDR | `edr_process`, `edr_file_write`, `edr_registry_modify` | detection name, ATP-style classification |
| Firewall | `fw_allow`, `fw_deny` | 5-tuple, rule name |
| VPN | `vpn_connect`, `vpn_disconnect` | client IP, geo, duration |
| DNS | `dns_query` | qname, qtype, resolved IP, reputation |
| Proxy | `proxy_request` | URL category, action (allow/block) |
| Cloud (AWS/Azure-flavored) | `cloud_iam_policy_change`, `cloud_s3_policy_change`, `cloud_console_login` | principal, resource ARN-style, before/after diff |
| PowerShell | `posh_script_block` | encoded command (decoded in payload for post-hoc review), script block ID |

Every event is Zod-validated against a per-`event_type` schema before insert, so authoring mistakes in a scenario template fail at author-time, not at learner-time.

### 7.2 How generation stays realistic without being real

1. **Template + randomization, not pure random.** A `scenario_event_templates` row defines a relative time offset and a value template (e.g., `entity_key: "{{finance_analyst}}"`, `source_ip: "{{attacker_ip_pool}}"`). At materialization, the generator resolves entity references from `scenario_entities` and picks from small, curated randomization pools (a set of plausible ASNs, device names, process names) rather than fully random noise — this is what makes the output look like a real environment instead of Lorem Ipsum.
2. **Deterministic seeding per session.** `session.id` seeds a PRNG (mulberry32 or similar, no crypto requirement here) so re-materializing a session for debugging or regrading produces byte-identical telemetry.
3. **Decoys are first-class, not accidental.** `scenario_event_templates.is_decoy = true` events are benign look-alikes generated *because* keyword-only search must not trivially solve a scenario (this pattern already exists in `case-data.ts`'s `decoy` flag on threat indicators — the generator formalizes and extends it to full events, not just indicators).
4. **Volume realism.** Beyond the ground-truth event chain, the generator layers in a configurable amount of ambient noise (routine sign-ins, benign DNS, normal process creation) scaled to `scenario.difficulty` — beginner scenarios have low noise-to-signal, expert scenarios approach real-SOC signal density.
5. **Time compression.** Real incidents unfold over hours or days; the generator compresses this into a `session_duration_minutes`-scoped window (configurable per scenario) while preserving *relative* timing between events, so timeline reasoning (e.g., "the OAuth consent happened 6 minutes before the token was minted") is pedagogically accurate.

### 7.3 Materialization pipeline

Scenario start → **Telemetry Generator job** (queued, not inline — target < 3s but never blocks the request thread): resolve `scenario_entities` → for each `scenario_event_templates` row, resolve the template into a concrete `security_events` row with real timestamps → bulk insert (`COPY` or multi-row `INSERT`, not row-by-row) → hand off to the **Alert Engine** (§8) to generate the alerts the learner actually sees.

---

## 8. Alert Engine

### 8.1 Detection rules

A `detection_rules` catalog table (`id`, `name`, `description`, `query_definition jsonb`, `default_severity`, `mitre_technique_id`) holds declarative rules: "N failed sign-ins for one identity within M minutes from ≥2 distinct countries" (impossible travel / password spray), "process `powershell.exe` with `-EncodedCommand` and command-line entropy above threshold," "OAuth consent grants `Mail.Read` + `offline_access` to an app first-seen < 7 days ago." Rules are evaluated in application code (a small rules engine, not a SQL feature) against the freshly-materialized `security_events` for a session — this is intentionally simple (not a streaming CEP engine) because volume per session is small and bounded (hundreds to low thousands of events, not a real SOC's millions/day).

### 8.2 Correlation logic

Events sharing an `entity_key` within a rolling window are grouped into correlation candidates; a rule firing against a candidate group produces one alert referencing all contributing `security_events.id`s (`alerts.source_event_ids`). Cross-entity correlation (the email → identity → endpoint → cloud chain already modeled in the existing marketing demo data) happens as a second pass: alerts sharing entities within a scenario are candidates for auto-promotion into a single `incident` (§8.4), mirroring the existing UI's "37 signals joined into 1 candidate incident" narrative.

### 8.3 Prioritization & severity

Severity is authored per-template (`scenario_event_templates`/`detection_rules.default_severity`) but can escalate: an alert's effective severity is `max(template_severity, correlation_boost)` where `correlation_boost` increases with the number of distinct techniques/entities it touches — this is what produces the "critical" labeling on multi-stage chains even when any single event looks medium.

### 8.4 False positives, suppression, deduplication

- **Decoy-triggered alerts** are intentional false positives by design — part of the grading rubric penalizes pinning them as evidence (`noise_included_event_ids` in §6.4).
- **Deduplication:** identical `(rule_id, entity_key)` firing again within a cooldown window updates the existing alert's `source_event_ids` rather than creating a duplicate.
- **Suppression:** an instructor or the Scenario Builder can mark a rule "informational only" for a specific scenario (it still fires and is visible, but is excluded from scoring) — used for teaching "here's noise you should learn to ignore" without it counting against the learner.

---

## 9. Identity Investigation Service

A proprietary portal (`app.identity.tsx`), modeled on Entra ID's investigation surface without depending on it. Each `scenario_entities` row of `entity_type = identity` renders as an identity profile assembled from `attributes` (jsonb) + the session's `security_events` filtered to that `entity_key`:

- **Profile:** name, department, role, manager, **risk level** (computed, not stored — a function of open critical alerts touching this identity).
- **Devices:** join via `security_events` where `entity_key` matches a device the identity signed into.
- **Authentication history:** `security_events` where `event_type IN (entra_signin, m365_signin)`, rendered as a table — outcome, app, client, conditional-access result.
- **Group membership, MFA status, simulated password history, conditional access policy hits:** stored as `attributes` fields at scenario-authoring time (static per scenario, since modeling live directory state isn't the point — the investigation is).
- **Sign-in timeline:** the same events, timeline-rendered.
- **Risky sign-ins / impossible travel / password spray detection:** these are *alerts* (§8) scoped to this identity, not separately computed here — the portal is a view, not a second detection engine.
- **Geo-location:** derived from `security_events.detail.location` (templated per §7.1), rendered on a simple world-map-style visual (no real geo-IP dependency — coordinates are authored/randomized within the template).
- **Behavior timeline:** the global timeline (§6.3 `timeline_entries`) filtered to this entity, giving the learner the same "add to case timeline" affordance already built in `app.timeline.tsx`.

---

## 10. Device Investigation Service

`app.endpoints.tsx`, modeled on Defender's endpoint page. Same assembly pattern as §9, sourced from `scenario_entities` (`entity_type = device`) joined with that entity's `security_events`:

- **Device overview:** hostname, OS, owner identity, **risk score** (computed from open alerts), **isolation status** (`endpoints.isolated` — already a field in the existing Zustand model, `toggleIsolate`; server-side this becomes a `response_actions` entry in `action_log`, not a raw boolean flip, so it's part of the graded action trail).
- **Installed software / running processes / startup entries / services:** authored as static `attributes` for the device's baseline state, with any *malicious* additions represented as their own `security_events` rows (e.g., a `sysmon_process_create` for the actual attacker process) — the learner should be able to tell baseline from anomaly, which requires the baseline to be believable, not randomly generated.
- **Network connections / open ports:** `security_events` of type `sysmon_network_connect` / `fw_allow`/`fw_deny` scoped to the device.
- **File timeline / registry changes:** `edr_file_write` / `edr_registry_modify` events.
- **USB activity:** a dedicated `event_type` (`edr_usb_insert`) — already reflected in the existing seed data's "USB mass storage inserted (executive)" alert.
- **Security events / malware history:** the device's alerts, filtered.
- **Isolation action:** a first-class `response_actions` row (`isolate-host`), loggable and gradable against `scenario_ground_truth.required_action_ids`.

---

## 11. Email Investigation Module

`app.email.tsx`, an Outlook-style reader over `email_messages` (§6.5):

- **Email viewer:** rendered from `body_html` — **always through a sanitizer (DOMPurify) and a sandboxed iframe** (`sandbox="allow-same-origin"` only, no scripts), since this is the one place the platform intentionally renders attacker-authored-flavored HTML (§15.9).
- **Headers:** raw `headers` jsonb, pretty-printed, including the full `Received:` chain so learners practice reading hop-by-hop origin.
- **Authentication results:** `spf`/`dkim`/`dmarc` columns rendered as pass/fail chips, exactly the signal a real analyst reads first.
- **Attachment analysis:** filename, sha256, and a **simulated sandbox verdict** (`benign`/`suspicious`/`malicious` + a canned behavioral summary authored per scenario, not a real detonation) — the file itself, if the learner wants to "download" it, is a harmless stub stored in object storage, never a real payload.
- **URL analysis:** extracted `urls` cross-referenced against session-scoped `threat_indicators` — clicking "check reputation" in the UI is a read against that table, not a live web lookup (this is a training platform; nothing calls out to the real internet for verdicts).
- **Campaign correlation:** `email_messages.campaign_id` → `threat_campaigns`, surfacing "this sender/domain/actor also appears in 2 other alerts this session."
- **Threat intelligence panel:** shared component with §9/§10/§16.9 — same indicator-lookup API, different context.

---

## 12. Scenario Engine

### 12.1 Scenario Builder

`app.scenario-builder.tsx` today edits the client-only seed shape; server-side it becomes a CRUD surface over `scenarios` → `scenario_entities` → `scenario_event_templates` → `scenario_ground_truth`. Authoring flow: define entities → author the event timeline (with relative offsets) → mark which events are ground-truth evidence and which are decoys → tag required MITRE techniques and response actions → write the model-answer summary → set difficulty/category → save as `draft`.

### 12.2 Difficulty levels

`beginner` / `intermediate` / `advanced` / `expert` drive three things at materialization time: noise-to-signal ratio (§7.2 point 4), number of entities in play, and whether hints are auto-offered vs. must be manually requested.

### 12.3 Hidden ground truth

`scenario_ground_truth` is **never included in any API response the learner's session can reach** (§15.4) — enforced by a dedicated repository method (`getGroundTruthForScoring`) callable only from the Scoring Engine's internal code path, not exposed through the general scenario-read endpoints. This is the single most important security property of the whole platform (a leaked answer key defeats the product's purpose) and is treated as such in §15.

### 12.4 Automated evaluation (scoring)

Ports `scoreCase()` from `src/lib/store.ts` verbatim in spirit, server-side, reading `scenario_ground_truth` instead of an imported `groundTruth` object:

```
total = round(
    techniqueAccuracy * 30 +
    evidenceRecall     * 25 +
    evidencePrecision  * 15 +
    responseActionsPct * 15 +
    (verdictCorrect ? 15 : 0)
  - hintPenalty
)
hintPenalty = min(15, hintsUsed * 5)
techniqueAccuracy = max(0, (techniqueHits - 0.5 * techniqueWrong) / requiredTechniques.length)
```

This is a pure function of `(investigation_session, scenario_ground_truth)` — deterministic and idempotent, so regrading after an instructor's `reopenCase` produces a trustworthy new score with no side effects on unrelated data.

### 12.5 Hints

A `scenario_hints` table (`scenario_id`, `sequence`, `body`, `unlock_cost`) — requesting a hint increments `investigation_sessions`-scoped `hints_used` (already modeled) and is itself an `audit_logs` entry, so "did they need a hint to find X" is available to both the scoring function and instructor analytics.

### 12.6 Instructor override & versioning

`reopenCase` (already built client-side) becomes: instructor writes `instructor_feedback`, sets `investigation_sessions.status = reopened`, learner can resubmit — new `scores` row, old one preserved in `score_history`. Scenario edits bump `scenarios.version`; **in-flight sessions keep the version they started with** (`investigation_sessions.scenario_version`) so an author fixing a typo mid-cohort never silently changes what a half-finished investigation is being graded against.

### 12.7 Randomization

Beyond telemetry-value randomization (§7.2), a scenario can define multiple **entity pools** (e.g., 3 possible "compromised identity" candidates) so the same scenario slug produces a different specific narrative per session — reduces answer-sharing between cohort members without authoring N separate scenarios.

---

## 13. Learning Platform

- **Courses / Labs:** a `courses` → `lessons` hierarchy (video/text content, hosted alongside a scenario reference) sits above the investigation engine — the scenario is the "lab," the course is the surrounding curriculum.
- **Learning paths:** `learning_paths` → `learning_path_items` (ordered courses + scenarios), matching the "SOC Analyst Career Track" / "Blue Team Career Track" framing already named in the vision doc and reflected in `app.learning.tsx`.
- **Progress tracking:** `learning_path_progress (user_id, learning_path_item_id, status, completed_at)`.
- **Achievements:** rule-based badges (`achievement_rules`: e.g., "score > 90 on 3 expert scenarios") evaluated as a post-scoring hook, not a cron job — instant gratification matters for gamification.
- **Leaderboards:** materialized view over `scores` + `investigation_sessions`, refreshed every few minutes (not real-time-computed — a leaderboard is read-heavy and tolerant of slight staleness), scoped by cohort/org/global.
- **Certificates:** issued when a `learning_path` reaches 100% with a minimum average score; triggers a queued job (§18.5) that renders a PDF (server-side, via a headless-Chromium-free approach — `@react-pdf/renderer` or similar, avoiding a full browser dependency for cost reasons) and writes a `certificates` row + public verify page (`verify.$id.tsx`, already scaffolded).

---

## 14. AI Features

Explicitly **future** work, designed for but not required at MVP — none of these touch `scenario_ground_truth` directly (the AI never sees the answer key; it reasons over the same evidence a learner has access to, or in the Copilot's case, is *given* the ground truth only to generate the post-submission model-answer narrative, server-side, never streamed to a learner mid-investigation).

- **AI Investigation Assistant:** given a session's `security_events` + the learner's current `evidence_items`/`notes`, suggest "have you considered checking X entity's sign-in history" — a retrieval-over-session-data + LLM call, rate-limited per session to control cost.
- **AI Hint System:** generates a hint phrased around what the learner has *already* pinned, rather than a static canned hint — nice-to-have upgrade over §12.5's static table.
- **Natural Language Search:** translates a plain-English query into the structured query used by `app.search.tsx` (§16.8) — an LLM-to-KQL-flavored-filter translator, not a raw LLM-over-raw-DB pass (keeps it safe and cheap: the LLM never gets direct DB access, only proposes a filter object the existing search endpoint validates and executes).
- **AI Report Writer:** drafts the learner's case summary from their pinned evidence and notes — assistive, not authoritative; the learner edits before submission, and drafting activity itself is loggable (so "did they write it themselves" analytics are possible later).
- **AI Feedback:** post-submission, generates prose feedback contrasting the learner's investigation with the ground truth — a straightforward templated-LLM-call over already-computed `ScoreBreakdown` data (§12.4), not a new scoring mechanism.
- **SOC Copilot:** long-term vision — a persistent assistant across the whole console (the "AI Core" already depicted in the marketing site's dashboard mock), scoped down from full autonomy deliberately: it explains and suggests, the learner still performs every graded action themselves.

All AI features route through a single internal `AiGatewayService` so provider choice, prompt versioning, and per-tenant rate limits/cost caps live in one place, never called ad hoc from route handlers.

---

## 15. Security Architecture

1. **Authentication:** email+password (argon2id hashing) or SSO (SAML/OIDC via WorkOS for Enterprise tier). Short-lived JWT access token (15 min) + rotating refresh token (httpOnly, `Secure`, `SameSite=Strict` cookie) — access tokens are never stored in `localStorage` (avoids XSS token theft).
2. **Authorization / RBAC:** the four roles from §6.1 map to a capability matrix (`student`: read/write own sessions only; `instructor`: read cohort sessions, write feedback, no cross-org access; `org_admin`: manage org's users/cohorts/billing; `platform_admin`: everything, MFA-required, action-logged). Every API handler declares its required capability; a shared middleware checks it before the handler runs — capabilities are never checked ad hoc inside business logic.
3. **Tenant isolation:** every query that touches tenant-scoped tables includes `organization_id` in its `WHERE` clause via the query-builder layer (Drizzle), not left to each handler to remember — a lint rule / repository-pattern wrapper makes an un-scoped query a build-time error, not a runtime bug.
4. **Ground-truth protection (product-critical, not generic):** `scenario_ground_truth` is read only by the Scoring Engine's internal repository method; the general scenario/session read endpoints (§16.5–16.7) are constructed from an explicit allow-list of columns, never `SELECT *`, so a future column added to that table can't accidentally leak through an existing endpoint.
5. **Encryption:** TLS 1.2+ everywhere (Nginx-terminated). At rest: full-disk encryption on the VPS/managed DB; application-layer encryption (AES-256-GCM, key in the secrets manager) for `organizations.sso_config` and `users.mfa_secret` specifically, since those are higher-value than general row data.
6. **Secrets:** never in the repo (`.env` is gitignored; this repo's `.gitignore` already covers it); rotated on any suspected exposure; distinct secrets per environment (dev/staging/prod).
7. **Session management:** refresh tokens are stored hashed in a `sessions` table (revocable server-side — "log out everywhere" is a real delete, not just a client-side token discard); idle timeout 30 days, absolute max 90 days.
8. **Rate limiting:** per-IP and per-user token-bucket limits at the API Gateway layer (Redis-backed), tighter limits on auth endpoints (login, password reset) to blunt credential stuffing, and a specific tighter limit on evidence-pin/note endpoints to prevent a scripted "solve the scenario by brute-forcing every event" attack.
9. **API security / input validation:** every request body validated with Zod at the route boundary before it reaches business logic (matches the existing frontend's Zod dependency — same validation library, shared schema package between client and server where the shapes overlap, e.g. form inputs). Email HTML (§11) is sanitized (DOMPurify) before any render. File uploads (scenario authoring attachments) are type- and size-restricted and stored under content-addressed keys (sha256) in object storage, never executed or served with an executable content-type.
10. **Audit logging:** every mutating action writes an `audit_logs` row (§6.6), hash-chained (`this_row_hash = sha256(prev_hash + row_content)`) so a break in the chain is detectable — doesn't require a blockchain, just a cheap tamper-evidence property appropriate for an education product's compliance story.
11. **Secure coding practices:** TypeScript strict mode repo-wide (already the case per `tsconfig.json`), Zod at every trust boundary, parameterized queries only (Drizzle prevents string-concatenated SQL by construction), dependency scanning in CI (`npm audit` / `osv-scanner`, both free), no secrets in logs (structured logger configured to redact known secret-shaped fields).

---

## 16. API Specification

Base URL: `/api/v1`. Auth: `Authorization: Bearer <access_token>` unless noted public. All responses: `{ "data": ..., "error": null }` or `{ "data": null, "error": { "code": "...", "message": "..." } }`.

### 16.1 `POST /api/v1/auth/login`
Request:
```json
{ "email": "sarah.chen@contoso.com", "password": "••••••••" }
```
Response `200`:
```json
{ "data": { "accessToken": "eyJ...", "user": { "id": "u_123", "fullName": "Sarah Chen", "roles": ["student"] } }, "error": null }
```
Sets `refreshToken` as an httpOnly cookie. `401` on bad credentials, `423` if account suspended.

### 16.2 `POST /api/v1/auth/refresh`
No body (reads the httpOnly cookie). Response `200`: new `accessToken`. `401` if the refresh token is revoked/expired.

### 16.3 `POST /api/v1/auth/logout`
Revokes the current refresh token server-side. `204` on success.

### 16.4 `GET /api/v1/scenarios`
Query params: `category`, `difficulty`, `status=published` (default). Response `200`:
```json
{ "data": [ { "id": "sc_1", "slug": "bec-finance-consent-phish", "title": "Consent phish → privileged data access",
  "category": "email", "difficulty": "advanced", "estimatedMinutes": 45, "mitreTechniqueIds": ["T1566.002","T1078","T1213"] } ], "error": null }
```

### 16.5 `POST /api/v1/scenarios/{id}/sessions`
Starts (materializes) a new investigation session. Response `201`:
```json
{ "data": { "sessionId": "sess_789", "scenarioVersion": 3, "startedAt": "2026-08-14T10:00:00Z", "status": "open" }, "error": null }
```
Internally: enqueues telemetry-generation + alert-engine jobs; the client polls or subscribes over WS for `session.ready`.

### 16.6 `GET /api/v1/sessions/{id}`
Response `200`: full session state — status, verdict, technique tags, hints used — **never includes ground truth**.

### 16.7 `GET /api/v1/sessions/{id}/events`
Query params: `entityKey`, `source`, `from`, `to`, `cursor`, `limit` (default 100, max 500 — always paginated, never a full dump). Response `200`:
```json
{ "data": { "items": [ { "id": "evt_1", "ts": "2026-08-14T02:14:00Z", "source": "Endpoint EDR",
  "eventType": "sysmon_process_create", "entityKey": "SRV-DB-07", "severity": "critical",
  "mitreTechniqueId": "T1059.001", "detail": { "commandLine": "powershell -enc ..." } } ],
  "nextCursor": "evt_101" }, "error": null }
```

### 16.8 `POST /api/v1/sessions/{id}/search`
Structured, KQL-flavored query body:
```json
{ "query": "entity:sarah.chen severity>=high last:24h" }
```
Server parses into the same filter shape as §16.7 (this is what powers `app.search.tsx`, and later the AI natural-language-search feature translates into this exact body — §14). Response: same shape as §16.7.

### 16.9 `GET /api/v1/sessions/{id}/alerts` / `GET /api/v1/sessions/{id}/incidents`
Standard list endpoints, filterable by `status`, `severity`.

### 16.10 `PATCH /api/v1/sessions/{id}/alerts/{alertId}`
Body: `{ "status": "resolved" }` or `{ "assignedUserId": "u_123" }` or `{ "dismissReason": "..." }`. Every field change writes to `audit_logs`.

### 16.11 `POST /api/v1/sessions/{id}/evidence`
```json
{ "securityEventId": "evt_1", "justification": "Encoded PowerShell on a DB host immediately after an unfamiliar SSH login is consistent with credential-access staging." }
```
`201` with the created `evidence_items` row. `DELETE /api/v1/sessions/{id}/evidence/{eventId}` unpins.

### 16.12 `POST /api/v1/sessions/{id}/actions`
```json
{ "actionId": "isolate-host", "targetEntityKey": "SRV-DB-07", "reason": "Active LSASS credential dumping observed." }
```
Applies the action (e.g., flips a device's simulated isolation state) and appends to `action_log` — this is what §12.4's `responseActionsPct` scores against.

### 16.13 `POST /api/v1/sessions/{id}/submit`
```json
{ "verdict": "true-positive" }
```
Response `200`:
```json
{ "data": { "score": { "total": 87, "techniqueAccuracy": 92, "evidenceRecall": 80, "evidencePrecision": 100,
  "responseActionsPct": 100, "hintPenalty": 5, "verdictCorrect": true }, "modelAnswer": "..." }, "error": null }
```
Runs the Scoring Engine (§12.4) synchronously (it's fast and deterministic — no need to queue it) and sets `status = closed`.

### 16.14 `GET /verify/{certificateId}` (public, no auth)
```json
{ "data": { "recipientName": "Sarah Chen", "learningPath": "SOC Analyst Career Track",
  "issuedAt": "2026-06-01", "status": "valid" }, "error": null }
```
`404`-equivalent (`{ "data": null, "error": { "code": "NOT_FOUND" } }`) for an unknown/revoked ID — matches this repo's own certificate-verification pattern from the ClickBox marketing site, applied here.

### 16.15 `GET /api/v1/cohorts/{id}/roster` (instructor+)
List of learners with `latestSessionStatus`, `averageScore`, `scenariosCompleted`.

### 16.16 `POST /api/v1/sessions/{id}/reopen` (instructor+)
```json
{ "feedback": "Good technique tagging, but you missed the S3 policy widening — check the cloud tab before submitting next time.", "scoreAdjustment": 0 }
```

### 16.17 WebSocket channel `wss://.../ws/sessions/{id}`
Server → client events: `session.ready` (telemetry materialized), `alert.created`, `alert.updated`, `timeline.updated`. Used for the live-feeling alert stream without polling.

---

## 17. Frontend Architecture

The frontend is **already built** to a strong standard; this section documents it and the specific changes needed to move from client-only state to a real backend.

### 17.1 Stack (as configured today)

TanStack Start (file-based routing via `src/routes/*.tsx`, SSR-capable via Nitro) + React 19 + Tailwind CSS 4 + Radix UI primitives wrapped in a shadcn-style component layer (`src/components/ui/*`) + Zustand for client state (`src/lib/store.ts`) + Zod for validation + `react-hook-form` for forms + `framer-motion` for motion + `recharts` for analytics charts + TanStack Query (installed, not yet wired to a real API) for server-state caching once the backend exists.

### 17.2 Navigation structure

- **Marketing site** (`src/routes/index.tsx`, `src/components/soc/marketing/*`) — public, SSR'd for SEO, matches the live "AI-native Security Operations" landing page already verified running.
- **App shell** (`src/routes/app.tsx` → `AppShell` in `src/components/soc/app-shell.tsx`) — the authenticated console, wrapping every `app.*` route with the persistent sidebar/command-palette/topbar chrome.
- **Console pages** — one file per route as catalogued in §2's table; each currently a `WorkspacePage`-style component (`src/components/soc/workspace-page.tsx` is a shared layout primitive already in use) reading from `useSoc()`.
- **Auth-gated routing:** **(new)** a route-level loader on `app.tsx` checking session validity server-side (TanStack Start supports server-side loaders natively) redirecting to `/login` if absent — replaces relying on client-only state.

### 17.3 State management transition

Today: `useSoc()` (Zustand + `persist` middleware) is both the client cache *and* the source of truth, seeded from static imports. Target: Zustand keeps **UI-only** state (panel open/closed, draft text before save, optimistic-update overlay); TanStack Query owns **server** state (sessions, events, alerts, scores), keyed by `sessionId`, with mutations (`pinEvidence`, `submitCase`, etc.) becoming `useMutation` calls against §16's endpoints with optimistic updates rolled back on error. This is a incremental migration, not a rewrite — the store's existing action names and shapes were clearly designed with this split in mind already (note the `§12.4` and `§2.3` section references already present as comments in `store.ts`, suggesting the original author was working from a spec very close to this one).

### 17.4 Component/design patterns already established (to be preserved, not redesigned)

- `soc/primitives.tsx`, `soc/ui/*` — shared severity badges, sparkline, trend indicator, count-up stat — reused across every investigation surface for visual consistency.
- `soc/command-palette.tsx` — Cmd-K navigation, already wired.
- `soc/before-after.tsx`, `soc/interactive-cta.tsx` — marketing-site-specific, not console.

### 17.5 Responsive & accessibility

Console is desktop-first by product nature (a SOC analyst works on a large monitor; this is true of every real competitor product too) but must degrade gracefully to tablet for the marketing site and learner-facing progress/certificate pages, which do need to work on a phone. Accessibility baseline: all interactive elements keyboard-reachable (Radix primitives give this for free), color is never the sole signal for severity (already using icon + label + color in the existing seed-data-driven badges), focus-visible states preserved from the existing Radix defaults rather than stripped.

### 17.6 UX considerations specific to this product

- **Never show the ground truth**, obviously — but also never show *any* signal that leaks it indirectly (e.g., no "3 of 5 required techniques found" progress meter during an active investigation — that would let a learner narrow down the answer by trial and error rather than investigation).
- **Undo-friendly:** unpinning evidence, removing a timeline entry, and changing a verdict before submission are all cheap, encouraged actions — the product wants learners exploring, not afraid to touch things.
- **Post-submission is the teaching moment:** the model-answer narrative, missed-evidence list, and score breakdown are where the actual learning crystallizes — this view deserves as much design attention as the investigation surface itself.

---

## 18. Backend Architecture

### 18.1 Why one deployable, not real microservices, at MVP

Every "service" named in §4.2 is a **module boundary in one codebase**, not a separately deployed process, until there's a concrete scaling or team reason to split one out (Telemetry Generator is the most likely first candidate, since it's the most CPU-bound). This keeps the MVP's operational surface to one app + one worker + Postgres + Redis + object storage — directly serving §20's cost constraint — while the module boundaries (clear TypeScript package boundaries: `packages/core-api`, `packages/telemetry`, `packages/scoring`, `packages/scenario-authoring`, sharing a `packages/db` Drizzle schema package) make the eventual split mechanical, not a rewrite.

### 18.2 Core API Service responsibilities

Auth, users/orgs/cohorts CRUD, sessions/alerts/incidents/evidence/notes/actions CRUD (§16.1–16.13, 16.15–16.16), certificate verification (16.14, deliberately unauthenticated and cached hard since it's a public-trust surface).

### 18.3 Telemetry Generator responsibilities

Consumes a `session.start` job → resolves scenario templates → bulk-inserts `security_events` → emits `session.telemetry_ready` → hands off to the Alert Engine step in the same job (no need for a second queue hop for something this fast).

### 18.4 Scoring Engine responsibilities

Exposes one internal function, `scoreSession(sessionId, verdict)`, called synchronously from the `submit` handler (§16.13) — deliberately *not* a queued job, because it's fast (<50ms of pure computation over already-in-memory-sized data) and the learner is actively waiting for their result.

### 18.5 Background workers & event flow

| Job | Trigger | Work |
|---|---|---|
| `session.materialize` | `POST /sessions` | Telemetry generation + alert engine (§7.3, §8) |
| `scenario.scheduled_reset` | cron | For any long-running "live feed" scenario type, regenerate ambient noise on a schedule |
| `certificate.render` | learning path completion | Render PDF, upload to object storage, insert `certificates` row, send email |
| `report.generate` | on-demand (`POST /api/v1/reports`) or scheduled (weekly instructor digest) | Aggregate query + PDF/CSV render, upload, return signed URL |
| `email.send` | various (welcome, certificate-ready, cohort digest, instructor-feedback notification) | Transactional email via a provider (Resend/Postmark — pick one, low cost either way) |
| `nightly.backup` | cron | `pg_dump` → compress → upload to object storage (§5, §19) |

Error handling: every job is idempotent (safe to retry) and BullMQ's built-in retry/backoff handles transient failures; a job's terminal failure after retries writes an `audit_logs` entry with `action = "job.failed"` and alerts on-call via the monitoring stack (§5) rather than failing silently.

### 18.6 Scaling strategy

Read-heavy endpoints (`GET /events`, `GET /alerts`, scenario catalog) get a short-TTL Redis cache keyed by request params; write-heavy endpoints (evidence pin, notes) go straight to Postgres — at MVP's expected concurrency (tens to low hundreds of concurrent sessions) this needs no further optimization. The first real scaling lever, when needed, is horizontal API instances behind the load balancer (§5) — the API layer is already stateless (JWT auth, no server-side session affinity needed) so this requires zero code change.

---

## 19. Deployment Strategy

### 19.1 MVP: single VPS, Docker Compose

```yaml
# docker-compose.yml (illustrative)
services:
  app:
    build: .
    env_file: .env
    depends_on: [postgres, redis, minio]
    restart: unless-stopped
  worker:
    build: .
    command: ["node", "dist/worker.js"]
    env_file: .env
    depends_on: [postgres, redis]
    restart: unless-stopped
  postgres:
    image: postgres:16
    volumes: ["pgdata:/var/lib/postgresql/data"]
    env_file: .env
  redis:
    image: redis:7
    volumes: ["redisdata:/data"]
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    volumes: ["miniodata:/data"]
    env_file: .env
  nginx:
    image: nginx:alpine
    volumes: ["./nginx.conf:/etc/nginx/nginx.conf:ro", "./certs:/etc/nginx/certs:ro"]
    ports: ["80:80", "443:443"]
    depends_on: [app]
volumes:
  pgdata:
  redisdata:
  miniodata:
```

A single mid-tier VPS (4 vCPU / 8GB RAM, ~$40–60/mo from Hetzner/DigitalOcean/OVH) comfortably runs this whole stack for the first few hundred concurrent learners. Deploy: push to `main` → CI (GitHub Actions, free for a repo this size) builds and pushes a Docker image → a simple SSH-deploy step pulls and restarts via `docker compose up -d`. TLS via Let's Encrypt (`certbot`, free, auto-renewing).

### 19.2 Environment variables

```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
S3_ENDPOINT=... S3_ACCESS_KEY=... S3_SECRET_KEY=... S3_BUCKET=...
JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=...
RESEND_API_KEY=... (or chosen email provider)
STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...
SSO_WORKOS_API_KEY=... (Enterprise tier only)
AI_PROVIDER_API_KEY=... (only once §14 ships)
NODE_ENV=production
PUBLIC_APP_URL=https://app.clickbox.io
```

### 19.3 Migration path to scale

1. **Managed Postgres** (Neon, Supabase, or RDS) — swap `DATABASE_URL`, enable PITR, add a read replica for analytics queries (§13 leaderboards, §16.15 roster views) so they never contend with transactional traffic.
2. **Managed Redis** (Upstash or ElastiCache) — same, connection-string swap.
3. **Object storage → Cloudflare R2** — S3-compatible API means this is a credential/endpoint change only; zero egress fees make it strictly cheaper than MinIO-on-a-VPS-with-bandwidth-caps at any real scale, and the existing Nitro config already defaults its build target toward Cloudflare (`vite.config.ts` comment), so this is the path of least resistance, not a detour.
4. **Kubernetes** — once running more than 2–3 app instances makes manual Compose management painful; the images don't change, only the orchestration layer (a Helm chart wrapping the same `app`/`worker` images).
5. **CDN + load balancer** — Cloudflare in front for static/SSR caching; a managed or Nginx-based LB in front of multiple app instances.
6. **High availability** — managed Postgres standby + automated failover; multi-instance app layer already stateless; Redis Cluster or a managed HA Redis once the queue/cache tier is a single point of failure worth eliminating.

---

## 20. Cost Optimization

The guiding rule: **every piece of infrastructure must have a $0-egress-fee, no-license, swap-in-place path.** Concretely:

- **No proprietary SIEM/telemetry dependency** (already a hard product requirement) — this alone removes what would otherwise be the single largest cost line for a "SOC platform."
- **Single VPS at MVP** instead of any managed PaaS premium — Hetzner/OVH-class providers run the full Docker Compose stack for well under $100/mo including backups, versus multiples of that on a managed platform for equivalent resources.
- **Postgres + Redis + MinIO, all open-source, all self-hostable** — no license cost at any scale; the managed-service upgrade path (§19.3) is purely for *operational* convenience later, not a functional requirement, so it can be deferred until revenue justifies it.
- **BullMQ over a managed queue** — Redis you're already running, no separate SQS/Pub-Sub bill.
- **Nitro's native WebSocket support** instead of a third-party realtime SaaS (Pusher/Ably) — zero incremental cost for a feature that would otherwise carry a per-connection bill.
- **Self-hosted Prometheus + Grafana** instead of a paid observability SaaS — the free tier of most such products caps out fast for a chatty console app; self-hosting on the same VPS costs only the RAM it uses.
- **Cloudflare R2 as the first "upgrade"**, specifically because its zero-egress-fee model means a growing library of scenario attachments and generated certificate PDFs never becomes a bandwidth cost surprise — this is the one piece of infra worth moving to a managed service *before* strictly necessary, because the alternative (MinIO on a bandwidth-capped VPS at scale) is the more expensive path, not the cheaper one.
- **Free-tier-friendly vendor choices everywhere a vendor is unavoidable:** Resend/Postmark for email (generous free tiers), WorkOS for SSO (free up to a meaningful connection count — critical, since Okta/Auth0-grade SSO pricing would otherwise be the single biggest fixed cost of the Enterprise tier), Let's Encrypt for TLS (free, forever), GitHub Actions for CI (free for this repo's traffic).
- **AI features (§14) are opt-in cost, not baseline cost** — none of them are required for the core product loop (generate → investigate → score), so LLM API spend only appears once a paying tier justifies it, and every AI call path (§14's closing paragraph) is designed to route through one gateway specifically so per-tenant cost caps can be enforced before a single runaway usage pattern becomes a bill surprise.
- **Lean MVP, room to scale:** every component in §5's "MVP" column has a named, drop-in "at scale" replacement in the same table and in §19.3 — nothing about the cost-conscious MVP choices requires a rewrite later, only a configuration and credential change, which is the actual design goal behind "keep the MVP lean while leaving room to scale."
