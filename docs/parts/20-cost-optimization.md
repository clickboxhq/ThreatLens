# 20. Cost Optimization

## 20.1 Guiding Principle

Every infrastructure decision in this document was made against a single constraint, stated explicitly here because it explains *why* the choices in §5 and §19 look the way they do: **the platform must run a commercially credible SaaS product on a single, modestly-sized VPS at MVP, with no infrastructure line item that scales with usage before the product has paying usage to scale against.** Cost optimization is not a separate afterthought layered on top of the architecture — it is one of the reasons the architecture looks like it does (the modular monolith of §4.6, the "generate once, archive after 90 days" telemetry lifecycle of §6.23, the deliberate exclusion of any per-session live LLM call from the core product in §7.6).

## 20.2 Cost Breakdown by Category (Phase 1 / MVP)

| Category | Choice | Approx. cost driver | Why this minimizes cost |
|---|---|---|---|
| Compute | One 8 vCPU/32GB VPS (§19.2) | Fixed monthly, provider-dependent, low three figures/month at this tier | One host instead of N managed services each with their own baseline fee; vertical scaling (bigger VPS) is cheaper per unit of headroom than horizontal managed infrastructure at this traffic level |
| Database | Self-hosted Postgres on the same VPS | $0 beyond the VPS itself | Avoids a managed-Postgres monthly minimum before there's revenue to justify it (§19.3 explicitly defers this) |
| Cache/Queue | Self-hosted Redis, same VPS | $0 beyond the VPS | One process serving three roles (§4.2) instead of three separate paid services |
| Object Storage | Self-hosted MinIO, same VPS | $0 beyond the VPS/attached disk | No per-GB/per-request billing until traffic genuinely requires offloading storage from the compute host |
| CDN | Free-tier CDN (§5.14) | $0 | Free tiers at major CDN providers comfortably cover MVP-level static asset traffic |
| Email delivery | Transactional email provider's free/starter tier | $0–low monthly | Cheaper and far more reliable than self-hosting SMTP and managing deliverability/reputation from scratch (§5.9) |
| Observability | Self-hosted Prometheus/Grafana/Loki, same VPS | $0 beyond the VPS | Avoids a managed observability vendor's per-host/per-GB-ingested pricing before scale justifies it |
| TLS | Let's Encrypt (§19.1) | $0 | Free, automated, industry-standard |
| CI/CD | GitHub Actions free tier | $0 at MVP volume | Sufficient minutes/month for a small team's build/deploy cadence |
| AI features | **Not built at MVP** (§14.8) | $0 | Deferred entirely to Phase 3, avoiding per-call LLM API cost before there's subscription revenue to fund it |
| Payments | Third-party processor, transaction-fee-only pricing | Percentage of revenue, not a fixed cost | No fixed monthly fee; cost scales naturally with revenue (§15.8) |

The realistic, honest takeaway: Phase 1 infrastructure cost is dominated almost entirely by the single VPS line item, everything else is free-tier or effectively free at this traffic level, and the single largest non-infrastructure cost at this stage is the team's own time — which is exactly why the modular-monolith/single-deployable-artifact choice (§4.6) matters as much for cost as the hosting bill does: it minimizes the operational time a small team spends on deployment/ops toil.

## 20.3 Deliberate Cost/Quality Trade-offs Made Explicit

- **99.0% availability, not 99.9%, at MVP (§3.2).** A multi-AZ, multi-replica setup capable of 99.9%+ costs meaningfully more (managed DB with standby, multiple compute hosts, a real load balancer tier) and is not commercially necessary for an education product's MVP phase; this is stated as an honest trade-off, not hidden from the availability target.
- **24-hour RPO, not near-zero, at MVP (§3.11).** Continuous point-in-time backup/replication is a paid managed-database feature; nightly backup + WAL archiving gets most of the practical benefit at a fraction of the cost, with the gap closed at Phase 2 once revenue justifies it (§19.3).
- **No live LLM-powered features at MVP (§14.8).** Per-call AI API cost, especially at a per-session granularity across hundreds of concurrent sessions, is one of the few costs in this stack that scales directly with usage rather than being a fixed monthly fee — exactly the kind of cost this phase is designed to avoid until subscription revenue exists to fund it, hence AI features are fully specified but explicitly deferred (§14.1).
- **Synthetic content generation has zero third-party API cost (§7.6).** By construction, the single most frequently-executed operation in the product (every scenario start, §7.7) has no external API dependency and therefore no per-use marginal cost beyond the VPS's own compute — this was a cost-driven architectural requirement, not only a latency/reliability one.
- **No video hosting infrastructure (§19.2).** Bandwidth-heavy content types are explicitly kept off the core infrastructure and delegated to third-party platforms built for that purpose, avoiding a cost category (egress bandwidth for video) that scales badly on a single VPS.

## 20.4 What Triggers Each Spend Increase

Rather than a fixed calendar-based upgrade schedule, every infrastructure spend increase in this document is tied to a concrete, observable trigger, so money is spent when the product's growth actually demands it, not speculatively:

| Spend increase | Trigger |
|---|---|
| Bigger VPS (vertical scaling) | Load testing or production monitoring (§3.10) shows §3.1 latency targets are at risk under current concurrent-session volume |
| Managed Postgres/object storage (§19.3) | First institutional/enterprise customer with a contractual DR/availability requirement the single-VPS setup can't credibly meet, **or** database size/load approaching what a single host can comfortably serve |
| Kubernetes migration (§19.4) | Concurrent-session volume consistently exceeds what vertical scaling on a single host can absorb, **and** revenue justifies the added operational complexity/cost of a multi-service, multi-node deployment |
| AI features (§14) | Subscription revenue run-rate can absorb ongoing per-call LLM API cost as a normal COGS line item without threatening unit economics |
| Managed observability vendor | Self-hosted Prometheus/Grafana/Loki's own resource footprint starts meaningfully competing with application workload for VPS capacity |

This trigger-based framing is the practical answer to "how do we keep the MVP lean while leaving room to scale" (§1.7, §3.6): every later-phase capability described in §19.3–§19.4 is fully specified in this document *now*, so no future spend decision requires new architectural design work — it only requires recognizing that its trigger condition has been met.
