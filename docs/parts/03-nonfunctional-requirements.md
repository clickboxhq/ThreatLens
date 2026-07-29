# 3. Non-Functional Requirements

Non-functional requirements are stated as concrete, testable targets wherever possible, tiered by deployment phase (§19) since the acceptable numbers for a single-VPS MVP are intentionally looser than for the post-PMF Kubernetes deployment. Where a target changes between phases, both are given as `MVP / Scale`.

## 3.1 Performance

- API P95 latency for read endpoints (alert list, entity profile, timeline fetch): **< 300ms MVP / < 150ms Scale**, measured server-side, excluding client network time.
- API P95 latency for write endpoints (note save, evidence pin, verdict submit): **< 500ms MVP / < 250ms Scale**.
- Search endpoint (§2.8) P95: **< 500ms MVP / < 200ms Scale** for a session-scoped dataset capped at 250,000 synthetic events (§3.9).
- WebSocket event delivery (new alert push, §5.10): **< 2s from Alert Engine emission to client receipt, both phases.**
- Scenario session cold-start (telemetry generation + alert seeding, §7/§8) must complete in **< 20s MVP / < 8s Scale**, because this is a first-impression latency a paying Student experiences every time they start a scenario. This directly drives the "pre-generate at publish time, not at session start" design decision in §7.7.
- Frontend initial load (Time to Interactive) on the Student dashboard: **< 2.5s on a broadband connection**, driven by the code-splitting strategy in §17.

## 3.2 Availability

- MVP target: **99.0% monthly** (≈ 7.3 hours downtime/month budget), consistent with a single-region, single-primary-database deployment on a VPS (§19.1). This is stated honestly rather than aspirationally — a bootstrapped single-VPS deployment cannot credibly promise "four nines," and promising it would create a support/refund liability. Maintenance windows are scheduled and communicated, not counted against the budget separately (i.e., the 99.0% figure already assumes competent, low-frequency maintenance).
- Scale target (post-Kubernetes migration, §19.4): **99.9% monthly** (≈ 43 minutes/month), backed by multi-AZ database (managed Postgres with standby), horizontally scaled stateless API pods, and a load balancer health-check-driven failover.
- The platform is **not** targeting 99.99%+ availability at any phase in this document's horizon — that tier is not commercially justified for an education product (unlike, say, a real SOC's actual SIEM, where downtime has security consequences). This is a deliberate, cost-driven scoping decision (§20).

## 3.3 Scalability

- MVP must comfortably support **500 concurrent active scenario sessions** on the single-VPS topology (§19.1) sized in §19.2, with headroom validated by load testing before general-availability launch.
- The architecture must scale horizontally by adding stateless API/worker replicas behind a load balancer with **no code changes**, only infrastructure changes — this is why session state, WebSocket presence, and job queues are designed from day one to live in Redis/Postgres rather than in-process memory (§5, §18).
- Telemetry generation and scoring are CPU/IO-bound background jobs, not request-path work, and are explicitly designed as horizontally scalable worker pools (§5.9, §18) so that scenario-session growth scales by adding workers, independent of API replica count.
- Database scalability: partitioning strategy for high-volume tables (`security_events`, `audit_logs`) is specified up front in §6.23 even though MVP volume does not require it yet, so the migration to partitioned tables at scale is a config change, not a schema redesign.

## 3.4 Latency (Real-Time Interaction)

- WebSocket connection establishment: **< 1s**.
- Scenario "live" mode (time-phased alert emission, §12.7) must maintain event ordering and deliver events within **± 2s** of their scheduled scenario-relative timestamp — timing precision matters pedagogically (a Student reasoning about "what happened first" must be able to trust the platform's delivery order).

## 3.5 Security

Full treatment in §15. Summary requirements gating all other design: TLS 1.2+ everywhere (no plaintext internal traffic across any network boundary that crosses a host, §15.3), argon2id password hashing, short-lived JWT access tokens with rotating refresh tokens, RBAC enforced at the API-gateway layer and re-validated at the service layer (defense in depth, §15.2), encryption at rest for the database volume and object storage, secrets never committed to source control or baked into images (§5.16), full audit logging of privileged actions (§15.9), and rate limiting on all public-facing endpoints (§15.5).

## 3.6 Cloud Architecture

The platform must be deployable, without code changes, on any of: a single Linux VPS via Docker Compose (MVP default, §19.1), or a managed Kubernetes service on any major cloud provider (§19.4). This portability requirement is why the architecture avoids any cloud-provider-proprietary managed service in its core dependency graph (Postgres, Redis, S3-compatible object storage, and a generic message queue are all available as both self-hosted OSS and managed-cloud offerings, §5).

## 3.7 Maintainability

- Backend services are organized as independently deployable modules with clear API boundaries (§18) even in the MVP's "modular monolith" deployment topology (§4.6), so that splitting any module into its own microservice later is a deployment change, not a rewrite.
- All services expose structured JSON logs (§5.14) and a `/health` and `/ready` endpoint.
- Database schema changes are managed exclusively through versioned, forward-only migrations (no manual schema edits against production, §6.24).
- Configuration is environment-variable-driven (§5.17) with no environment-specific code branches.

## 3.8 Reliability

- All background jobs (telemetry generation, scoring, email sending, certificate generation) are processed through a durable message queue with at-least-once delivery and idempotent job handlers (§5.9), so a worker crash mid-job never silently loses or double-applies work.
- Database writes for anything score-affecting (verdict submission, evidence pinning) occur inside transactions; partial writes must not be observable.
- Graceful degradation: if the WebSocket layer is unavailable, the frontend falls back to polling for alert updates rather than failing the session outright (§17.9).

## 3.9 Logging

- Application logs: structured JSON, correlation-ID-tagged per request (propagated from API Gateway through every downstream service call, §5.2), shipped to a centralized log store (self-hosted Loki in MVP, §19.1; managed log service optional at Scale).
- Domain audit logs (§6.22 `audit_logs` table) are logically distinct from application/operational logs: audit logs are a permanent, tamper-evident record of security-relevant and grading-relevant actions (login, role change, verdict submission, instructor override, admin impersonation), retained per the retention policy in §6.23, and are never subject to log-rotation deletion the way operational logs are.
- Synthetic security event volume per session is capped (default 50,000–250,000 events per scenario dataset, tunable per scenario) specifically so that "logging" in the pedagogical sense (the telemetry the Student investigates) never blurs with or overwhelms real application/audit logging.

## 3.10 Monitoring

- Golden signals (latency, traffic, errors, saturation) collected per service via Prometheus-compatible metrics exposition (§5.15), visualized in a self-hosted Grafana instance at MVP.
- Alerting on: API error-rate threshold, queue depth/age threshold (a stuck worker pool is a direct product-quality incident, since it delays scenario start), database connection saturation, disk usage threshold on the VPS/object storage.
- Business-metric monitoring (signup rate, conversion rate, churn) is a separate, product-analytics concern (§2.17) from infrastructure monitoring, but both dashboards are considered part of "launch readiness" for any release.

## 3.11 Disaster Recovery

- **RPO (Recovery Point Objective): MVP 24 hours / Scale 5 minutes.** MVP relies on nightly automated Postgres logical backups (`pg_dump`) plus continuous WAL archiving to object storage, which in practice allows point-in-time recovery closer to minutes, but 24h is the conservative committed SLA until this is proven in a real restore drill. Scale phase moves to a managed database with continuous backup and point-in-time restore as a vendor-provided guarantee.
- **RTO (Recovery Time Objective): MVP 4 hours / Scale 30 minutes.** A documented, periodically-drilled runbook (§19.5) covers full-stack restore from backup onto a fresh VPS.
- Object storage (scenario assets, uploaded evidence exports, certificates) is versioned and separately backed up from the primary database (§5.11), since a bug that corrupts one must not be able to corrupt the other in the same failure event.
- Backups are stored in a provider/region distinct from the primary compute host, satisfying the basic "backup is not co-located with the thing it backs up" requirement even at MVP cost levels (§20).
