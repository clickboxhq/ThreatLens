# Deploying to Railway

This is the current deployment target — `infra/docker-compose.prod.yml`/`DEPLOY.md` (a
single-VPS setup per `docs/SOCVerse-Architecture.md` §19.1) is kept as a reference/fallback,
not actively used. Railway replaces the VPS, nginx, and certbot entirely: every service gets
its own TLS-terminated domain and its own logs/metrics dashboard from Railway itself, so a
few pieces built for the VPS don't carry over — see "What's different" at the bottom.

Images are built by CI and pushed to Docker Hub; Railway pulls from there rather than
building from the repo itself, which is what "use Docker as the registry" means here (Docker
Hub, not Railway's own builder).

## One-time GitHub setup

In this repo's Settings → Secrets and variables → Actions:

**Secrets:**
- `DOCKERHUB_USERNAME` — your Docker Hub username or org.
- `DOCKERHUB_TOKEN` — a Docker Hub access token (Account Settings → Security → New Access
  Token on Docker Hub), not your password.
- `RAILWAY_TOKEN` — a Railway **project token**, scoped to one environment (Railway project →
  Settings → Tokens). Lets `.github/workflows/ci.yml`'s `railway-deploy` job trigger a redeploy
  after each image push.

**Variables** (not secret — baked into the web build, visible in the bundled JS either way):
- `VITE_API_BASE_URL` — set this *after* step 3 below, once you know the `api` service's
  Railway domain, e.g. `https://socverse-api-production.up.railway.app/api/v1`.

## One-time Railway setup

### 1. Create the project and add managed Postgres + Redis

New Project → Add Postgres, Add Redis (Railway's own plugins — automated backups, no ops
burden, and our least-privilege-role migration works fine against them since Railway gives
full admin access to its managed Postgres, not a locked-down instance).

### 2. Create the `api` service

New Service → Docker Image → `<dockerhub-username>/socverse-api:latest`.

Environment variables (use Railway's variable-reference picker — click the field and
autocomplete offers other services' variables — rather than typing these by hand, since your
Postgres/Redis plugin service names may differ from the examples below):

```
NODE_ENV=production
DATABASE_URL=postgresql://socverse_app:${APP_DB_PASSWORD}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
MIGRATE_DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_ACCESS_SECRET=<openssl rand -base64 48>
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_DAYS=30
TRUST_PROXY_HOPS=1
APP_DB_PASSWORD=<pick a strong value, distinct from Postgres's own password>
```

`MIGRATE_DATABASE_URL` uses Postgres's own `DATABASE_URL` directly (that plugin connection is
already superuser-equivalent — the same role `MIGRATE_DATABASE_URL` played against the VPS's
`socverse` superuser). `DATABASE_URL` is composed by hand for the least-privilege `socverse_app`
role instead, same as `infra/docker-compose.prod.yml` does — it doesn't exist until the
migration below creates it.

`WEB_ORIGIN` isn't set yet — comes back in step 4, once `web`'s domain exists.

Settings → Networking → Generate Domain, so you get a public URL for this service. Note it —
you'll need it for `VITE_API_BASE_URL` and for testing.

### 3. Run the first migration

```bash
railway login
railway link   # select this project
railway run --service api sh scripts/provision-app-role.sh
```

Applies `prisma/migrations` and rotates `socverse_app`'s password off the placeholder baked
into the migration file, to `APP_DB_PASSWORD` — see that script's own comments for why this
can't happen inside the migration itself. Safe to re-run on every future deploy (idempotent);
CI doesn't do this automatically since a migration is a schema change worth watching happen,
not something to silently fire on every push — rerun this command by hand after a deploy that
includes a new migration.

### 4. Create the `worker` service

New Service → Docker Image → same `<dockerhub-username>/socverse-api:latest` image.

Settings → Deploy → Custom Start Command: `node dist/src/worker-main`

Environment variables:

```
NODE_ENV=production
DATABASE_URL=postgresql://socverse_app:${APP_DB_PASSWORD}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
MIGRATE_DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
APP_DB_PASSWORD=<same value as api's>
```

No `JWT_ACCESS_SECRET`/`TRUST_PROXY_HOPS`/`WEB_ORIGIN` — none apply to a process with no REST
API and no client-facing HTTP surface beyond `/health`, `/ready`, `/metrics`. **Don't** generate
a public domain for this service — nothing should ever reach it directly; it only talks to
Postgres/Redis over Railway's private network.

### 5. Create the `web` service

Set the `VITE_API_BASE_URL` repo variable in GitHub now (step 0), using the `api` domain from
step 2, then push to `main` so CI rebuilds the web image with it baked in (VITE_-prefixed vars
are inlined into the JS bundle at build time, not read at runtime — see
`apps/web/Dockerfile.prod`'s own comment on this).

New Service → Docker Image → `<dockerhub-username>/socverse-web:latest`. No environment
variables needed — it's a static Nginx-served bundle. Generate a domain for it too.

### 6. Close the loop: set `WEB_ORIGIN` on `api`

Now that `web` has a domain, go back to the `api` service and add:

```
WEB_ORIGIN=https://<web's-railway-domain>
```

Redeploy `api` for it to take effect (CORS reads this at boot).

## Ongoing deploys

Push to `main` → CI runs the existing test suite → on success, builds and pushes
`socverse-api`/`socverse-web` to Docker Hub tagged `:latest` and `:<commit-sha>` → triggers
`railway redeploy` for `api`, `worker`, and `web`, which pulls `:latest` and restarts.
Migrations are **not** run automatically (see step 3) — run
`railway run --service api sh scripts/provision-app-role.sh` by hand after any deploy that
includes a new migration.

## Custom domains (optional)

Railway's own `*.up.railway.app` domains work fine for the trial. To use your own domain:
service → Settings → Networking → Custom Domain, then add the CNAME record Railway gives you
at your DNS provider. Update `VITE_API_BASE_URL`/`WEB_ORIGIN` to match once attached.

## What's different from the VPS path, and why

- **No nginx, no certbot.** Railway terminates TLS and routes to each service itself; there's
  no shared edge to configure, and no Let's Encrypt dance to automate.
- **`api` and `web` live on separate domains**, not one domain with path-based routing. Already
  handled with zero code changes — `apps/web/src/api/realtime.ts` derives the WebSocket URL
  from `VITE_API_BASE_URL` rather than assuming a shared origin, and `main.ts`'s CORS config
  already reads `WEB_ORIGIN` from an env var.
- **No self-hosted observability stack** (Prometheus/Grafana/Loki/Alertmanager,
  `infra/observability/`). Two of its pieces structurally can't run on Railway at all —
  node-exporter needs real host access Railway doesn't grant, and promtail needs the Docker
  socket, which Railway doesn't expose to your containers — and Railway's own per-service logs
  and CPU/memory/network dashboards cover the rest without fighting the platform. The `/metrics`
  endpoint (`apps/api/src/common/metrics`) is still there if you want to point an external
  Prometheus at it later; nothing about dropping the self-hosted stack removes it.
- **Managed Postgres/Redis** instead of self-hosted containers — the whole reason to move off
  a VPS. No `postgres`/`redis` services to run yourself.
- **No MinIO equivalent provisioned.** `OBJECT_STORAGE_*` env vars aren't read anywhere in
  `apps/api/src` currently (confirmed by grep) — there's nothing depending on object storage
  existing yet, so nothing to replace it with for now.
