# Production deploy runbook (Phase 1 / MVP — docs/SOCVerse-Architecture.md §19.1)

Single VPS, Docker Compose. This covers bringing the stack up on a fresh host and redeploying
after that. It does not cover the CI/CD build-and-push pipeline or observability stack
(prometheus/grafana/loki, §19.1) — those are separate, not-yet-built follow-ups.

## Prerequisites

- A VPS (§19.2: 8 vCPU / 32GB RAM starting point) with Docker + the Compose plugin installed.
- A domain's DNS A record pointed at the VPS's IP, before requesting a certificate.
- Ports 80 and 443 open in whatever firewall/security-group sits in front of the VPS.

## First deploy on a fresh host

```bash
git clone <repo> && cd <repo>/infra
cp ../.env.production.example ../.env.production
# edit ../.env.production: DOMAIN, LETSENCRYPT_EMAIL, and every change-me value

docker compose -f docker-compose.prod.yml --env-file ../.env.production build

# Applies prisma/migrations (creates the schema and the least-privilege socverse_app role,
# with a placeholder password) and then rotates that role to APP_DB_PASSWORD — see the comment
# in .env.production.example for why the rotation can't happen inside the migration itself.
docker compose -f docker-compose.prod.yml --env-file ../.env.production run --rm migrate

# One-time TLS bootstrap (dummy-cert dance, see the script's own comments for why).
chmod +x nginx/init-letsencrypt.sh
./nginx/init-letsencrypt.sh

docker compose -f docker-compose.prod.yml --env-file ../.env.production up -d
```

Verify: `https://<DOMAIN>/health` and `https://<DOMAIN>/ready` both return `{"status":"ok"}`,
and the site loads at `https://<DOMAIN>/`.

## Observability (§5.16, §19.1)

`docker compose ... up -d` also brings up prometheus, node-exporter, postgres-exporter,
alertmanager, loki, promtail, and grafana — no separate step needed. None of them are
internet-facing (no nginx location blocks route to them) except Grafana, which is bound to
`127.0.0.1:3001` on the VPS itself. Reach it via an SSH tunnel:

```bash
ssh -L 3001:localhost:3001 <user>@<vps-host>
# then open http://localhost:3001 locally — log in as admin / your GRAFANA_ADMIN_PASSWORD
```

The "SOCVerse — Golden Signals" dashboard (request rate/error rate/latency percentiles, BullMQ
queue depth, API process memory/event-loop lag, Postgres connections, host CPU/disk) is
pre-provisioned and populated automatically — nothing to configure by hand. See "Known gaps"
below for what's still a placeholder.

## Redeploying after a code change

```bash
cd infra
git pull
docker compose -f docker-compose.prod.yml --env-file ../.env.production build
docker compose -f docker-compose.prod.yml --env-file ../.env.production run --rm migrate
docker compose -f docker-compose.prod.yml --env-file ../.env.production up -d
```

`up -d` only recreates containers whose image or config actually changed, so this is a brief
restart of `app`/`web` behind nginx, not a full-stack bounce — postgres/redis/minio/nginx/
certbot keep running throughout. `depends_on` in docker-compose.prod.yml only gates startup
order, not restart order, so `migrate` is intentionally its own explicit step before `up -d`,
never something the `app` container runs implicitly at boot.

## Known gaps (deliberately out of scope for this pass)

- **No image registry / CI deploy step yet.** This runbook builds directly on the VPS from a
  `git pull`. §19.1's documented flow (CI builds/pushes images, then SSHes in to pull/restart)
  is a natural follow-up once you have a registry and VPS access to wire into
  `.github/workflows/ci.yml`.
- **`app` runs both the API and the BullMQ workers in one process/container**, not split into
  separate `app`/`worker` services as §19.1 describes. Fine at MVP traffic levels; revisit if a
  slow scoring/telemetry job ever starves API request handling.
- **Zero-downtime deploys aren't automated.** §19.1 describes a health-check-gated rolling
  restart; today's `up -d` briefly drops connections to `app`/`web` while they recreate.
- **Alerts fire but notify no one.** Prometheus evaluates the four conditions in
  `observability/prometheus/alert-rules.yml` and Alertmanager routes them, but the receiver in
  `observability/alertmanager/alertmanager.yml` is a placeholder — see that file's comment.
  Wiring real delivery (Slack/email/PagerDuty) needs your decision on which channel.
