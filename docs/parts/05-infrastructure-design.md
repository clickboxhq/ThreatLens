# 5. Infrastructure Design

## 5.1 Technology Stack Summary

| Layer | MVP Choice | Rationale |
|---|---|---|
| Frontend | React + TypeScript, Vite build | Large talent pool, mature ecosystem, fast dev iteration (§17) |
| API Gateway / Backend | Node.js (TypeScript) on NestJS, OR equivalent typed backend framework | Single language across FE/BE reduces team size needed (§20); NestJS's module system maps 1:1 onto the domain-service boundaries in §18 |
| Database | PostgreSQL 15+ | Relational integrity for grading-critical data, JSONB for flexible telemetry payloads, mature partitioning/replication story (§6) |
| Cache / Queue Broker / Pub-Sub | Redis 7+ | One dependency serving three roles at MVP cost (§4.2), trivially split later |
| Object Storage | MinIO (self-hosted, S3 API-compatible) | Free, self-hosted, drop-in swap for AWS S3/R2/B2 later (§5.11) |
| Reverse Proxy / LB | Nginx | Free, battle-tested, doubles as static file server for MVP |
| Containerization | Docker + Docker Compose (MVP) → Kubernetes (Scale) | §19 |
| Background Jobs | BullMQ (Redis-backed) | Mature Node.js job queue with retries, scheduling, dashboards |
| CI/CD | GitHub Actions | Free tier sufficient at MVP scale, industry standard |

This stack is a recommendation consistent with the cost and portability constraints in §3.6/§20, not a hard architectural requirement — any typed backend framework and any Postgres/Redis/S3-compatible trio satisfies the architecture in §4. What **is** required is that every choice remain swappable per the abstractions in §5.6–§5.11.

## 5.2 API Layer

The API Gateway is the single ingress for REST and WebSocket traffic (§4.2). It owns:
- **Routing** to domain-service modules (in-process at MVP, service-mesh/HTTP at Scale) via a declarative route table (verb + path → handler), so the routing table itself is the artifact that changes during the Scale migration, not the handlers.
- **AuthN**: JWT verification (§5.7).
- **Coarse AuthZ**: role-route matrix (§15.2) — is this role ever allowed to hit this route.
- **Correlation ID** generation/propagation (`X-Correlation-Id` header), attached to every downstream log line and error response for support traceability.
- **Rate limiting** (§15.5), implemented as Redis-backed sliding-window counters keyed by `user_id` (authenticated) or IP (unauthenticated).
- **Request validation** at the edge (schema validation against the OpenAPI contract, §16) before any handler code runs, rejecting malformed requests with 400 before they reach business logic.

All REST endpoints are versioned under `/api/v1/...` from day one (§16.1) so a breaking v2 can be introduced without disrupting existing frontend/mobile clients.

## 5.3 Database Layer

Single PostgreSQL instance at MVP (§19.1), with logical schema separation by domain service (`identity`, `investigation`, `scenario`, `learning`, `audit` — mirroring §18) even though physically one database, enforced by convention + migration tooling (§6.24) rather than physical instance separation, to keep MVP operational overhead low while preserving a clean seam for later physical separation if a specific service's load ever requires its own database (§19.4).

Connection pooling via PgBouncer (or the ORM's built-in pool at MVP scale) sits between the application and Postgres to avoid connection exhaustion under the concurrent-session targets in §3.3.

## 5.4 Caching

Redis serves as the application cache for: entity-profile reads (identity/device/mailbox detail views, §9–§11), session metadata, computed leaderboard rankings (§13.5), and rate-limit counters (§15.5). Cache keys are namespaced `{domain}:{sessionId}:{entityId}` with short TTLs (30–120s) for investigation data (freshness matters more than cache hit rate here, since scoring correctness depends on the Student seeing current data) and longer TTLs (hours) for mostly-static content like published scenario metadata and MITRE technique reference data.

Cache invalidation strategy: **write-through** for anything the platform itself mutates (evidence pin, note save — invalidate the specific key on write) and **TTL-expiry only** for data that is generated once and never mutated post-generation (telemetry, alerts) — the latter case needs no invalidation logic at all, which is a deliberate simplification enabled by the "generate once, then read-only" design of scenario telemetry (§7.7).

## 5.5 Authentication & Authorization (Infrastructure View)

Full policy detail in §15. Infrastructure summary: credentials stored as argon2id hashes; short-lived (15 min) signed JWT access tokens plus longer-lived (30 day), rotating, revocable refresh tokens stored hashed in Postgres (`refresh_tokens` table, §6.19); SSO (SAML 2.0 / OIDC) supported at the Org Admin tier for institutional buyers (§2.16) as a Phase 2 addition, implemented as an alternate token-issuance path feeding the same internal JWT format so no downstream service needs to know whether a session originated from password auth or SSO.

## 5.6 Data Access Abstraction

Every domain service accesses Postgres exclusively through a typed repository layer (no raw SQL scattered through business logic, no ORM query building outside the repository layer) and accesses Redis exclusively through a small internal `CacheClient`/`QueueClient`/`PubSubClient` interface (§4.2). This is the concrete mechanism that makes "swap Redis roles onto separate instances later" (§4.2) and "swap MinIO for S3" (§5.11) zero-application-code-change operations: only the client implementation's connection config changes.

## 5.7 Authentication Token Details

- Access token: JWT, HS256 at MVP (single-service secret, §5.16) or RS256 at Scale (public-key verification without a network call to the auth service from every replica), 15-minute expiry, claims: `sub` (user id), `role`, `org_id` (nullable), `session_version` (incremented on password change/logout-all to allow instant invalidation of already-issued access tokens without a blocklist, §15.7).
- Refresh token: opaque random 256-bit token, stored **hashed** (not plaintext) in `refresh_tokens`, rotated on every use (old token invalidated, new one issued — detects token replay/theft), 30-day sliding expiry, revocable individually (single device logout) or in bulk (logout-all-devices, security-incident response).

## 5.8 Containerization

Every service (API Gateway/monolith at MVP, each split service at Scale), the worker pool, Postgres, Redis, MinIO, and Nginx run as Docker containers. A single `docker-compose.yml` at MVP (§19.1) defines the full stack for both local development and production VPS deployment, with environment-specific override files (`docker-compose.prod.yml`) rather than divergent configs, so "works in dev" and "works in prod" are the same container images with different env vars (§5.17) — eliminating an entire class of environment-drift bugs.

## 5.9 Message Queues & Background Workers

BullMQ (Redis-backed) provides named queues, each with its own worker pool and concurrency limit, isolating slow/bursty job types from each other:

| Queue | Producer | Consumer | Notes |
|---|---|---|---|
| `telemetry-generation` | Scenario publish action / session start | Telemetry Generator worker (§7) | Heaviest CPU job; concurrency capped per worker to protect the shared VPS at MVP |
| `alert-correlation` | Telemetry Generator completion | Alert Engine worker (§8) | Chained after telemetry job via BullMQ flow/dependency feature |
| `scoring` | Scenario submission | Scoring Engine worker (§12.4) | Must complete fast (§3.1) since the Student is watching a results screen |
| `email` | Various (welcome, cert issued, cohort invite) | Email worker | Uses a transactional email provider's API, not self-hosted SMTP (§20 — cheap, avoids deliverability pain) |
| `reporting` | PDF export request, scheduled analytics rollup | Reporting worker | Lower priority, can tolerate multi-second latency |

All jobs are **idempotent** by design (§3.8): each job payload carries a natural idempotency key (e.g., `sessionId` for telemetry generation), and handlers check-then-act against Postgres state so a duplicate delivery (BullMQ's at-least-once guarantee) never double-generates telemetry or double-applies a score.

## 5.10 WebSockets

A lightweight Realtime module inside the API Gateway (§4.4) manages WebSocket upgrade, auth (JWT passed as a connection query param or first-message auth frame), and per-session channel subscription. Server→client message types are a small, versioned, documented set (`alert.new`, `alert.updated`, `incident.status_changed`, `timeline.updated`) — the WebSocket channel is a push-notification convenience, never the sole source of truth for any data (§3.8's reliability principle extends here: the frontend must always be able to reconstruct current state via REST GET if a socket message is missed, §17.9).

## 5.11 Object Storage

S3-compatible API (MinIO self-hosted at MVP, §19.1) with buckets: `scenario-assets` (instructor-uploaded email templates, images, decoy documents used in scenario authoring, §12.1), `pregenerated-telemetry` (§7.7's cached telemetry bundles), `exports` (PDF incident reports, gradebook CSVs), `certificates` (issued certificate PDFs), and `backups` (§3.11, replicated to a separate provider/region). All buckets are private by default; client access to any object is via short-lived signed URLs issued by the owning service, never public bucket ACLs (§15.6).

## 5.12 Scheduled Jobs

A cron-style scheduler (BullMQ's repeatable jobs at MVP; a Kubernetes CronJob at Scale, §19.4) drives: nightly database backup (§3.11), nightly analytics rollup (pre-aggregating §2.17's dashboards so they don't compute from raw tables on every admin page load), weekly stale-session cleanup (sessions abandoned mid-scenario past a TTL are archived, freeing their telemetry from hot storage per §6.23's retention policy), and monthly leaderboard-period rollover (§13.5).

## 5.13 Deployment Architecture

Detailed in §19. Summary: MVP is Docker Compose on a single VPS behind Nginx with Let's Encrypt-issued TLS certs, auto-renewed via certbot's standard cron mechanism. Scale phase is a managed Kubernetes cluster with the same container images, a managed Postgres (RDS/Cloud SQL-equivalent) replacing self-hosted Postgres, and a managed object storage service replacing self-hosted MinIO — a lift, not a rewrite, because of the abstraction discipline in §5.6.

## 5.14 CDN

Static frontend assets and public pages (§4.2) are served through a CDN from day one — this is one of the few "spend a little even at MVP" infrastructure choices, because CDN tiers suitable for this traffic level are free or near-free (Cloudflare's free tier, or the CDN bundled with the chosen static-hosting provider) and the latency/cost benefit (§3.1, §20) is disproportionate to the near-zero cost.

## 5.15 Load Balancer

MVP: Nginx performs both TLS termination and (trivial, single-upstream) load balancing to the one application container. Scale: a cloud provider's managed load balancer (or an Nginx/HAProxy tier run as its own scaled deployment) distributes traffic across N API Gateway replicas using least-connections or round-robin, with active health checks against each replica's `/health` endpoint (§3.7) removing unhealthy replicas from rotation automatically.

## 5.16 Monitoring & Logging (Infrastructure View)

Prometheus + Grafana (self-hosted containers at MVP, §19.1) scrape `/metrics` from every service and worker for the golden signals in §3.10. Loki (self-hosted, same Grafana stack) aggregates structured JSON logs (§3.9) from all containers via Docker's logging driver. At Scale, these are either kept self-hosted (now justified by higher traffic making self-hosting's fixed cost worthwhile relative to a managed observability vendor) or swapped for a managed observability provider — a deployment-config decision made on cost data at the time, not an architectural one.

## 5.17 Secrets Management

MVP: secrets (database credentials, JWT signing key, object storage keys, transactional email API key) are injected as environment variables from a `.env` file that is **never committed to source control** (enforced via `.gitignore` and a pre-commit secret-scanning hook, §15.11), loaded by Docker Compose's `env_file` directive. Scale: secrets move to a dedicated secrets manager (cloud provider's native secrets manager, or a self-hosted Vault) injected into Kubernetes pods via mounted secret volumes or the CSI secrets-store driver, removing plaintext `.env` files from any host entirely. In both phases, secrets are rotated on any suspected exposure and on a routine schedule for the JWT signing key specifically (§15.7).

## 5.18 Environment Variables

Every service reads configuration exclusively from environment variables validated at process startup against a strict schema (fail fast on missing/malformed config rather than failing later on first use) — covering database/Redis/object-storage connection strings, JWT secret/algorithm, token TTLs, external email provider API key, feature flags (§2.16), and the deployment environment name (`development` / `staging` / `production`) used only for logging/observability tagging, never for behavioral branching (§3.7's "no environment-specific code branches" principle).
