-- Fixes a production-only bug: "add to timeline" (POST .../timeline) has been failing with
-- a 500 on every deployed environment since 20260807000100_add_timeline_items shipped, because
-- `timeline_items` was created without any grant to the least-privilege `socverse_app` runtime
-- role (see 20260806001500_add_least_privilege_app_role) — the app connects as `socverse_app`
-- and Postgres correctly refused it INSERT/SELECT access (42501 permission denied).
--
-- Root cause: 20260806001500's `ALTER DEFAULT PRIVILEGES FOR ROLE "socverse"` only auto-grants
-- tables created by migrations that *run as* `socverse` — true for local dev/CI/docker-compose,
-- where the Postgres image is bootstrapped with POSTGRES_USER=socverse. Railway's managed
-- Postgres addon, however, was provisioned with its own default superuser, `postgres` (Railway
-- never saw POSTGRES_USER=socverse — that only exists in this repo's own docker-compose files),
-- and `MIGRATE_DATABASE_URL` on Railway connects as that role (infra/RAILWAY.md). So on Railway
-- specifically, every migration since 20260806001500 has been running as `postgres`, not
-- `socverse` — the default-privileges rule silently never applied, and `timeline_items` (the
-- only new table added since) came up ungranted. Nothing caught this because CI's e2e Postgres
-- container mirrors docker-compose's `socverse`-as-superuser setup, not Railway's.
GRANT SELECT, INSERT, UPDATE, DELETE ON "timeline_items" TO "socverse_app";

-- Belt-and-braces for whichever role this migration itself runs as here (`postgres` on Railway,
-- `socverse` locally/CI/docker-compose-prod) — covers any future table the *other* environment's
-- rule wouldn't reach, without needing this to be revisited per-environment again.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'postgres') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" '
      || 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "socverse_app"';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" '
      || 'GRANT USAGE, SELECT ON SEQUENCES TO "socverse_app"';
  END IF;
END
$$;
