# 4. Complete System Architecture

## 4.1 High-Level Data Flow

```
                                   ┌───────────────────────────┐
                                   │         Browser            │
                                   │  (Student / Instructor /   │
                                   │   Org Admin / Platform     │
                                   │   Admin SPA, §17)          │
                                   └─────────────┬───────────────┘
                                                 │ HTTPS + WSS
                                   ┌─────────────▼───────────────┐
                                   │      CDN / Edge Cache        │
                                   │  (static assets, §19.6)      │
                                   └─────────────┬───────────────┘
                                                 │
                                   ┌─────────────▼───────────────┐
                                   │      Load Balancer / Nginx   │
                                   │  TLS termination, §5.13      │
                                   └─────────────┬───────────────┘
                                                 │
                                   ┌─────────────▼───────────────┐
                                   │        API Gateway           │
                                   │  authN/authZ, rate limit,    │
                                   │  routing, request logging    │
                                   │  §5.2, §15                   │
                                   └──┬──────┬──────┬──────┬─────┘
                  ┌────────────────────┘      │      │      └───────────────────┐
        ┌─────────▼────────┐      ┌───────────▼───┐ ┌▼─────────────┐  ┌─────────▼─────────┐
        │  Identity/Auth    │      │ Investigation │ │  Scenario &   │  │  Learning Platform │
        │  Service          │      │ Domain        │ │  Content      │  │  Service           │
        │  (§18.2)          │      │ Services      │ │  Services     │  │  (§18.5, §13)      │
        │                   │      │ (§18.3, §8-11)│ │ (§18.4, §12)  │  │                    │
        └─────────┬────────┘      └───────┬───────┘ └───────┬───────┘  └─────────┬─────────┘
                  │                        │                 │                     │
                  └────────────┬───────────┴────────┬────────┴──────────┬──────────┘
                                │                    │                   │
                     ┌──────────▼─────────┐ ┌─────────▼─────────┐ ┌───────▼──────────┐
                     │  PostgreSQL          │ │  Redis             │ │  Object Storage    │
                     │  (system of record,  │ │  (cache, session,  │ │  (S3-compatible:   │
                     │  §6)                  │ │  pub/sub, queue    │ │  scenario assets,  │
                     │                       │ │  broker, §5.6/5.9) │ │  exports, certs,   │
                     │                       │ │                    │ │  §5.11)            │
                     └──────────────────────┘ └────────────────────┘ └────────────────────┘
                                │
                     ┌──────────▼──────────────────────────────────────────────────┐
                     │                  Background Worker Pool (§5.9)                │
                     │  ┌────────────────────┐  ┌────────────────────┐               │
                     │  │ Telemetry Generator │→ │  Alert Engine       │→  Scoring   │
                     │  │  Service (§7)        │  │  Service (§8)       │   Engine    │
                     │  └────────────────────┘  └────────────────────┘   (§12.4)     │
                     └─────────────────────────────────────────────────────────────┘
```

## 4.2 Component Roles

**Browser (SPA).** A single frontend codebase serving four role-scoped shells (Student, Instructor, Org Admin, Platform Admin — §17.1) from one build, route-gated by role after authentication. Communicates with the backend exclusively through the API Gateway's REST endpoints (§16) and a single WebSocket channel per active session for real-time alert/timeline push (§5.10).

**CDN / Edge Cache.** Serves the built frontend bundle, public marketing pages, and public certificate-verification pages. At MVP this is a lightweight, low/no-cost CDN in front of the static asset bucket; it is not in the critical path for any authenticated API traffic and is the first component to swap for a bigger provider as traffic grows, with zero backend impact (§20.2).

**Load Balancer / Reverse Proxy (Nginx).** TLS termination, HTTP→HTTPS redirect, and — in the MVP single-VPS topology — the actual load-balancing/reverse-proxy layer in front of the containerized services (§19.1). At Scale, this role is taken over by a cloud load balancer in front of horizontally scaled API Gateway pods (§19.4).

**API Gateway.** The single authenticated entry point for all client traffic. Owns: JWT verification, RBAC policy enforcement (coarse-grained — is this role allowed to call this route at all — with fine-grained, resource-level checks pushed down to the owning service, §15.2), per-IP and per-account rate limiting (§15.5), request correlation-ID injection, and routing to the correct downstream service. In the MVP modular-monolith deployment (§4.6) the "downstream services" it routes to are in-process module calls; at Scale they become real network calls to independently deployed services, and the Gateway's routing table is the only thing that changes.

**Domain Services.** Described fully in §18. Each owns its own tables (schema-per-service is the *logical* boundary even when physically co-located in one Postgres instance at MVP, §6.1) and exposes its functionality only through its documented API (§16) — no service reaches into another service's tables directly, even pre-split, so that the eventual physical split is mechanical rather than a redesign.

**PostgreSQL.** The system of record for every durable entity in the platform: users, scenarios, sessions, synthetic telemetry, scores, audit logs. Full schema in §6.

**Redis.** Serves three distinct roles that are logically separate even though they share one process at MVP cost tiers (§20): (1) an application cache (entity-profile reads, leaderboard computations), (2) the pub/sub backbone for WebSocket fan-out across API Gateway replicas (§5.10), and (3) the broker for the background job queue (§5.9). At Scale, these three roles can be split onto separate Redis instances/clusters without any application code change, since the client abstraction (§18) already addresses them as three separate logical connections.

**Object Storage (S3-compatible).** Holds large or immutable binary/blob content: pre-generated scenario telemetry bundles (§7.7), exported PDF reports/certificates, uploaded instructor scenario assets (email templates, malware sample metadata — never real malware, §12.1), and database backup artifacts (§3.11). MinIO self-hosted at MVP; swappable for AWS S3/Cloudflare R2/Backblaze B2 at Scale via the same S3-compatible API (§5.11, §20).

**Background Worker Pool.** Consumes jobs from the Redis-backed queue (§5.9): telemetry generation (§7), alert correlation (§8), scoring (§12.4), email delivery, certificate rendering, scheduled analytics rollups (§5.12). Horizontally scalable independent of API replica count (§3.3).

**Telemetry Generator Service, Alert Engine, Scoring Engine.** These three are drawn as a pipeline because that is their logical data dependency (you cannot generate alerts without telemetry, and you cannot score an investigation without knowing which alerts/ground-truth techniques existed) — but they are three separately deployable services/worker types, not one monolith, each detailed in §7, §8, and §12.4 respectively.

## 4.3 Request Lifecycle Example (End-to-End)

To make the architecture concrete, trace a single representative user action — a Student opening the Device Portal for a specific device inside an active scenario session:

1. Browser sends `GET /api/v1/sessions/{sessionId}/devices/{deviceId}` with `Authorization: Bearer <access_token>` over HTTPS.
2. Nginx terminates TLS, forwards to the API Gateway.
3. API Gateway validates the JWT signature and expiry, extracts `user_id` and `role`, checks the coarse RBAC policy for this route (Student role permitted), generates a `correlation_id`, and forwards the request to the Device Investigation Service (§10) — an in-process module call at MVP, an HTTP call to a separate service at Scale.
4. Device Investigation Service verifies **resource-level** authorization: does `sessionId` belong to `user_id` (or is the caller an Instructor/Admin with legitimate cross-session access, §15.2)? If not, 403.
5. Service checks Redis cache for this device profile (`device_profile:{sessionId}:{deviceId}`); on a cache miss, queries Postgres (`devices`, `process_events`, `network_events`, `file_events`, `registry_events` — §6 device/event tables) scoped to `sessionId`, assembles the response DTO, writes it to Redis with a short TTL (§5.6).
6. Service logs the read as an `investigation_action` of type `view_entity` (§6.13) — used later for scoring's "did the Student actually look at this evidence" signal and for the Global Timeline replay feature.
7. Response returns through the Gateway to the Browser; correlation ID is included in the response header for client-side error reporting correlation.

This same pattern (Gateway → domain service → resource-level authz → cache-or-DB → structured logging of the action) is the template for every read endpoint in §16.

## 4.4 Real-Time Path

WebSocket connections are established directly to the API Gateway (which proxies the upgrade to a lightweight Realtime module, §5.10) and authenticated with the same JWT used for REST calls. When the Alert Engine (background worker) emits a new alert for a live-mode scenario, it publishes to a Redis pub/sub channel scoped to `session:{sessionId}`; every API Gateway replica subscribed to that pattern forwards the event to any locally-connected WebSocket client for that session. This pub/sub indirection is what allows the Realtime module to be horizontally scaled (§3.3) — a worker never needs to know which specific Gateway replica holds a given Student's socket.

## 4.5 Trust Boundaries

Three trust boundaries are enforced end-to-end and referenced throughout §15:

1. **Public Internet ↔ Load Balancer.** Only TLS 443 (and 80 for redirect) is exposed. No other port is internet-reachable in any deployment topology.
2. **Load Balancer/Gateway ↔ Internal Services.** Internal service-to-service traffic (at Scale, once physically split) occurs on a private network/VPC with no public ingress; MVP's modular monolith has no network hop here at all, which is strictly more secure by default and is one of the deliberate advantages of the phased topology (§4.6).
3. **Services ↔ Data Stores.** Postgres, Redis, and object storage are never directly reachable from the public internet in any phase; credentials are injected via the secrets mechanism in §5.16, never hardcoded.

## 4.6 Why a "Modular Monolith" at MVP

The architecture in §4.1 is drawn as if services are already physically separate because that is the *contract* every module must honor from day one (§3.7). But the actual MVP deployment (§19.1) runs the API Gateway and all domain services as **one process** (a modular monolith) for three concrete reasons:

- **Cost.** One compute process is dramatically cheaper to host than five-plus independently deployed services with their own resource reservations, at a traffic level (§3.3, 500 concurrent sessions) that doesn't need the isolation.
- **Latency.** In-process module calls avoid network hops entirely, which materially helps hit the aggressive MVP latency targets in §3.1 on modest hardware.
- **Operational simplicity for a small team.** One deployable artifact means one CI/CD pipeline, one set of logs to tail, one process to restart — appropriate for the team size implied by the cost constraints in §20.

The module boundaries (§18) are still enforced at the *code* level (each domain service is its own package/namespace with an explicit public interface and no direct cross-module table access) specifically so that the Scale-phase migration (§19.4) to physically separate, independently scaled services is a deployment and dependency-injection change, not a rewrite of business logic.
