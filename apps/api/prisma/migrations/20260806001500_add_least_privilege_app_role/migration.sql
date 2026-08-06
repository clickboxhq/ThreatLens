-- §15.9 defense-in-depth. Until now the running app connected to Postgres as `socverse`, which
-- is the database's superuser/owner role (it's what POSTGRES_USER creates in the postgres Docker
-- image). Superusers bypass every GRANT/REVOKE check, which meant the append-only REVOKE on
-- audit_logs from 20260805232813_add_audit_logs was correctly configured but had no actual
-- effect — a compromised app process could still UPDATE/DELETE its own audit trail.
--
-- This migration creates a separate, ordinary role for the app to connect as at runtime.
-- Migrations keep running as `socverse` (via Prisma's `directUrl`, see schema.prisma) since DDL
-- needs owner privileges; only the app's own runtime connection (`url`) moves to this role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'socverse_app') THEN
    CREATE ROLE "socverse_app" LOGIN PASSWORD 'socverse_app_dev_password';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE "socverse" TO "socverse_app";
GRANT USAGE ON SCHEMA "public" TO "socverse_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "public" TO "socverse_app";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "public" TO "socverse_app";

-- Tables/sequences created by later migrations (still run as `socverse`) get the same grants
-- automatically, so this role doesn't need to be revisited every time the schema grows.
ALTER DEFAULT PRIVILEGES FOR ROLE "socverse" IN SCHEMA "public"
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "socverse_app";
ALTER DEFAULT PRIVILEGES FOR ROLE "socverse" IN SCHEMA "public"
  GRANT USAGE, SELECT ON SEQUENCES TO "socverse_app";

-- The one deliberate exception: audit_logs stays append-only for this role too, same as it
-- already is for `socverse` — otherwise the broad grant above would have just re-opened it.
REVOKE UPDATE, DELETE ON "audit_logs" FROM "socverse_app";
