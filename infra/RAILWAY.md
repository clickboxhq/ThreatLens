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
- `VITE_API_BASE_URL` — set this *after* step 2 below, once you know the `api` service's
  Railway domain, e.g. `https://socverse-api-production.up.railway.app/api/v1`.

## One-time Railway setup

### 1. Create the project and add managed Postgres + Redis

New Project → Add Postgres, Add Redis (Railway's own plugins — automated backups, no ops
burden, and our least-privilege-role migration works fine against them since Railway gives
full admin access to its managed Postgres, not a locked-down instance).

### 2. Create the `api` service

New Service → Docker Image → `<dockerhub-username>/socverse-api:latest`.

Settings → Deploy → Custom Start Command:

```
sh -c "sh scripts/provision-app-role.sh && node dist/src/main"
```

This runs `prisma/migrations` and rotates `socverse_app`'s password off the placeholder baked
into the migration file (to `APP_DB_PASSWORD` below) every time `api` starts, before booting
the app itself — see that script's own comments for why the rotation can't happen inside the
migration file directly. Safe to run on every deploy, not just the first one: `migrate deploy`
is idempotent and re-applying the same `APP_DB_PASSWORD` is a no-op.

(This runs *inside* the container, which matters: `railway run` executes locally on your own
machine with the service's env vars injected, not inside the deployed image — it can't reach
this script or the `prisma` CLI, both of which only exist in the image. Chaining it into the
start command is what actually runs it in the right place, no `railway ssh`/`railway run` step
needed.)

Environment variables (use Railway's variable-reference picker — click the field and
autocomplete offers other services' variables — rather than typing these by hand, since your
Postgres/Redis plugin service names may differ from the examples below). Note
`${{APP_DB_PASSWORD}}` is double-braced even though it's referencing a variable on this same
service — Railway only recognizes `${{...}}`, never a single-brace `${VAR}`; the latter gets
stored as a literal, unexpanded string, which silently breaks `socverse_app`'s authentication
rather than erroring at save time:

**`JWT_ACCESS_SECRET` and `APP_DB_PASSWORD` below are placeholders, not values** — the
angle-bracket text describes what to generate, it is not something to paste in literally.
Generate real ones (e.g. `openssl rand -base64 48` for the JWT secret, any strong random string
for the DB password) and type the *result* into Railway's Variables tab. Pasting the placeholder
text itself in was a real incident on this project: `api`'s JWT secret and DB password sat live
in production as the literal strings below for a while before anyone noticed, since Railway
accepts any string with no validation. See "Rotating credentials" below if you need to check or
replace what's live now.

```
NODE_ENV=production
DATABASE_URL=postgresql://socverse_app:${{APP_DB_PASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
MIGRATE_DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_ACCESS_SECRET=<openssl rand -base64 48>
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_DAYS=30
TRUST_PROXY_HOPS=1
APP_DB_PASSWORD=<pick a strong value, distinct from Postgres's own password>
RESEND_API_KEY=<your Resend API key, from resend.com/api-keys>
EMAIL_FROM=SOCVerse <onboarding@resend.dev>
```

`RESEND_API_KEY` powers email verification and password reset (`apps/api/src/common/email/email.service.ts`)
— without it, `api` still runs fine, but both flows fall back to only *logging* the
verification/reset link server-side instead of emailing it (visible in this service's Deploy
Logs), which is fine for internal testing but not for real users who have no log access. Sign
up at resend.com, create an API key, and set it here. `EMAIL_FROM` defaults to Resend's own
`onboarding@resend.dev` sender, which works immediately with no domain setup — switch it to an
address on your own domain once you've verified that domain in Resend, so email doesn't look
like it's coming from Resend's shared address. `worker` doesn't need either variable; it never
sends email.

`MIGRATE_DATABASE_URL` uses Postgres's own `DATABASE_URL` directly (that plugin connection is
already superuser-equivalent — the same role `MIGRATE_DATABASE_URL` played against the VPS's
`socverse` superuser). `DATABASE_URL` is composed by hand for the least-privilege `socverse_app`
role instead, same as `infra/docker-compose.prod.yml` does — it doesn't exist until the first
deploy's migration step creates it, so this service's first deploy will fail its own healthcheck
briefly before that finishes — expected, not a bug.

`WEB_ORIGIN` isn't set yet — comes back in step 5, once `web`'s domain exists (step 4).

Settings → Networking → Generate Domain, so you get a public URL for this service. Note it —
you'll need it for `VITE_API_BASE_URL` and for testing.

Deploy this service and confirm its logs show `Nest application successfully started` before
moving on — `worker` (next) depends on the `socverse_app` role this step creates, so deploying
`api` first, and confirming it actually finished, avoids `worker` failing the same way on its
own first boot.

### 3. Create the `worker` service

New Service → Docker Image → same `<dockerhub-username>/socverse-api:latest` image.

Settings → Deploy → Custom Start Command: `node dist/src/worker-main`

Environment variables. **`APP_DB_PASSWORD` must be the real value you generated for `api`
above, not the placeholder text** — same role, same password, both services:

```
NODE_ENV=production
DATABASE_URL=postgresql://socverse_app:${{APP_DB_PASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
MIGRATE_DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
APP_DB_PASSWORD=<same value as api's>
```

No `JWT_ACCESS_SECRET`/`TRUST_PROXY_HOPS`/`WEB_ORIGIN` — none apply to a process with no REST
API and no client-facing HTTP surface beyond `/health`, `/ready`, `/metrics`. **Don't** generate
a public domain for this service — nothing should ever reach it directly; it only talks to
Postgres/Redis over Railway's private network.

### 4. Create the `web` service

Set the `VITE_API_BASE_URL` repo variable in GitHub now (step 0), using the `api` domain from
step 2, then push to `main` so CI rebuilds the web image with it baked in (VITE_-prefixed vars
are inlined into the JS bundle at build time, not read at runtime — see
`apps/web/Dockerfile.prod`'s own comment on this).

New Service → Docker Image → `<dockerhub-username>/socverse-web:latest`. No environment
variables needed — it's a static Nginx-served bundle. Generate a domain for it too.

### 5. Close the loop: set `WEB_ORIGIN` on `api`

Now that `web` has a domain, go back to the `api` service and add:

```
WEB_ORIGIN=https://<web's-railway-domain>
```

Redeploy `api` for it to take effect (CORS reads this at boot).

## Ongoing deploys

Push to `main` → CI runs the existing test suite → on success, builds and pushes
`socverse-api`/`socverse-web` to Docker Hub tagged `:latest` and `:<commit-sha>` → triggers
`railway redeploy` for `api`, `worker`, and `web`, which pulls `:latest` and restarts. Since
migrations run as part of `api`'s own start command (step 2), a schema change ships and applies
automatically on the same deploy — nothing to run by hand.

## Rotating credentials

How to check what's actually live, or replace it, without touching code:

1. Railway dashboard → your project → click the `api` service → **Variables** tab (this is the
   Raw Editor view, not the deploy logs).
2. Find `JWT_ACCESS_SECRET` and `APP_DB_PASSWORD`. Railway masks values by default — click a
   variable to reveal it if you need to confirm it isn't still the literal placeholder text from
   this doc (`<openssl rand -base64 48>` etc.).
3. To set a new value: generate one locally —
   ```
   openssl rand -base64 48
   ```
   for `JWT_ACCESS_SECRET`, or any long random string for `APP_DB_PASSWORD` — then paste the
   *output*, not the command, into the variable's value field and save. Saving triggers an
   automatic redeploy of `api`.
4. If you rotate `APP_DB_PASSWORD`, update it to the same new value on the `worker` service too
   (its own Variables tab) — same `socverse_app` role, both services authenticate with it.
   `worker` won't reconnect to Postgres until you do.
5. Rotating `JWT_ACCESS_SECRET` invalidates every currently-issued access/refresh token —
   logged-in users get signed out and need to log back in. Fine to do any time, just don't expect
   existing sessions to survive it.

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
