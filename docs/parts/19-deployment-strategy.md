# 19. Deployment Strategy

## 19.1 Phase 1: Single VPS (MVP)

A single Linux VPS (sizing guidance in §19.2) runs the entire stack via Docker Compose:

```
docker-compose.yml services:
  nginx        — reverse proxy, TLS termination (Let's Encrypt/certbot), static asset serving
  app          — the modular-monolith API Gateway + all domain services (§4.6), N=1-2 replicas
  worker       — background worker process(es) consuming all BullMQ queues (§5.9)
  postgres     — PostgreSQL 15, single instance, volume-mounted for persistence
  redis        — Redis 7, single instance
  minio        — S3-compatible object storage
  prometheus, grafana, loki — observability stack (§5.16)
```

This is the entirety of the production topology for Phase 1. Deployment is a `git pull` + `docker compose pull && docker compose up -d` on the VPS driven by a CI/CD pipeline (§5.1) that builds and pushes images on merge to `main`, then SSHes into the VPS to trigger the pull/restart — deliberately simple, appropriate for the team size and traffic level this phase is scoped for (§4.6, §20). Zero-downtime deploys are achieved via Nginx + a brief rolling restart of the `app` container behind a health-check gate (§3.7's `/health`/`/ready` endpoints) rather than a full blue-green setup, which is not yet justified at this scale.

## 19.2 Phase 1 Sizing

Target: the 500-concurrent-session load in §3.3. Recommended starting point: an 8 vCPU / 32GB RAM VPS (a mid-tier offering from any major VPS provider — Hetzner, DigitalOcean, Linode-equivalent), with Postgres and the application/worker processes co-located initially and load-tested before general-availability launch (§3.1's latency targets are the pass/fail criterion for this sizing, not a guess); object storage (MinIO) can run on the same host at this scale given education-content asset sizes are modest (no video hosting in-platform — any produced video content is hosted on a third-party platform and embedded, keeping storage/bandwidth costs off the core infrastructure entirely). Vertical scaling (a larger VPS) is the correct first lever if load testing shows headroom is needed before Phase 2's traffic level justifies horizontal/managed infrastructure investment.

## 19.3 Phase 2: Managed Data Services, Same Compute Topology

As paid usage grows (§1.7 Phase 2) and before the single-VPS's availability ceiling (§3.2's 99.0% MVP target) becomes a competitive/contractual liability for institutional buyers, the first migration step is **not** a full Kubernetes cut-over — it's swapping the highest-risk self-hosted stateful components for managed equivalents while keeping the same Docker Compose-deployed application containers:
- Self-hosted Postgres → managed Postgres (automated backups, point-in-time recovery, read replica option) — a `DATABASE_URL` environment variable change (§5.18), no code change, because of the repository-layer abstraction in §5.6.
- Self-hosted MinIO → managed S3-compatible object storage (AWS S3, Cloudflare R2, Backblaze B2) — again a config/credential change only (§5.11).
- Self-hosted Redis optionally → managed Redis, if operational burden (not raw cost) becomes the deciding factor.
This step meaningfully improves the DR posture (§3.11's RPO/RTO tighten toward the Scale-phase targets) and availability (no longer a single point of failure on the compute host for data durability) at a modest, usage-justified cost increase, while deliberately deferring the larger architectural/operational investment of Kubernetes until traffic actually demands horizontal scaling beyond what a bigger single VPS can provide.

## 19.4 Phase 3: Kubernetes, Autoscaling, High Availability

Full migration to a managed Kubernetes service (EKS/GKE/AKS-equivalent):
- Each domain service in §18.1 becomes its own Deployment with its own container image, resource requests/limits, and independent Horizontal Pod Autoscaler configuration (§18.7) — the physical split enabled by, and only by, the module-boundary discipline maintained since MVP (§4.6).
- The API Gateway becomes a Deployment behind a cloud Load Balancer / Ingress controller (§5.15), replacing Nginx's single-VPS role; Nginx's TLS-termination/reverse-proxy role is taken over by the Ingress controller.
- Worker pools become their own Deployments, scaled per §18.7's per-queue signal.
- Postgres runs multi-AZ with a standby (managed service feature); Redis runs as a managed cluster with the three logical roles (cache/pub-sub/queue-broker, §4.2) optionally split onto separate instances once their independent load profiles justify it.
- A service mesh or the platform's native internal networking provides service-to-service TLS and internal DNS-based service discovery (§4.5, §15.3), replacing in-process module calls.
- CI/CD extends to build/push per-service images and apply Kubernetes manifests (Helm charts or equivalent) per environment, with staged rollout (canary or rolling-update with automated health-check-gated rollback) replacing the simple restart-based deploy of Phase 1.

## 19.5 Disaster Recovery Runbook (Summary)

A documented, versioned runbook (kept in the repository, not only in an external wiki, so it stays in sync with the actual deployed topology) covers, at minimum: (1) full-stack restore from the most recent Postgres backup + WAL replay onto a fresh host, (2) object-storage restore from its independently-replicated backup (§3.11), (3) DNS/TLS cert re-issuance if the restore target is a new host, (4) post-restore validation checklist (health checks, a synthetic end-to-end scenario-session smoke test) before declaring recovery complete, and (5) a quarterly scheduled drill (restoring into an isolated environment, not production) to keep the runbook's RTO claim (§3.11) honest rather than aspirational.

## 19.6 CDN and Static Asset Delivery Across Phases

Consistent across all three phases (§5.14): the built frontend bundle and public marketing/catalog pages are served through a CDN from day one, decoupled from the backend compute topology entirely — this is the one piece of infrastructure that does not need to "migrate" between phases, since a CDN in front of a static asset origin is equally valid whether that origin is the Phase 1 VPS's Nginx, Phase 2's object storage bucket, or Phase 3's Kubernetes-served build artifact.

## 19.7 Environment Parity

Local development uses the identical `docker-compose.yml` (with a `docker-compose.override.yml` for dev-only conveniences like hot-reload volume mounts and seeded test data) as Phase 1 production, and CI runs integration tests against the same containers — the explicit goal (§3.7) being that "works in CI" and "works in production" are backed by the same container images and the same data-store technology at every phase, so environment-specific bugs are a rare, actively-designed-against category rather than a routine occurrence.
