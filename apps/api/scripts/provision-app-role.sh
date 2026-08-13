#!/usr/bin/env sh
# Runs Prisma migrations, then rotates the least-privilege socverse_app role's password off
# the placeholder baked into prisma/migrations/20260806001500_add_least_privilege_app_role —
# that migration necessarily ships with a fixed dev password (Prisma migrations are
# forward-only, committed to the repo, and checksum-verified on every future `migrate deploy`,
# so they can never hold a real per-environment secret without breaking every environment that
# already applied them). This script is the actual fix: password rotation happens here, driven
# by APP_DB_PASSWORD, automatically on every deploy — not as a manual runbook step to remember.
#
# Used as the `migrate` service's command in infra/docker-compose.prod.yml (the `build`-stage
# image, WORKDIR /repo, full monorepo layout: apps/api/prisma/...) and chained into the `api`
# service's own Custom Start Command on Railway (infra/RAILWAY.md, WORKDIR /app, flattened
# layout: prisma/... at the root). Detects which one it's in rather than needing a
# caller-supplied flag, since getting this wrong silently fails with a confusing "schema file
# not found" rather than anything indicating a layout mismatch.
#
# Safe to run repeatedly: `migrate deploy` is idempotent, and `ALTER ROLE ... PASSWORD` simply
# (re)sets the password to the same value if APP_DB_PASSWORD hasn't changed.
set -eu

if [ -f apps/api/prisma/schema.prisma ]; then
  SCHEMA_PATH=apps/api/prisma/schema.prisma
else
  SCHEMA_PATH=prisma/schema.prisma
fi

# 20260805232813_add_audit_logs and 20260806001500_add_least_privilege_app_role (both already
# applied everywhere else, forward-only, un-editable) hardcode the literal role/database name
# "socverse" — true in every environment this project ran in until now, where docker-compose's
# POSTGRES_USER/POSTGRES_DB are both literally "socverse". A managed provider (Railway: role
# `postgres`, database `railway`) has neither, so those two migrations fail outright with
# "role/database does not exist". Rather than rewrite history, satisfy the assumption: create a
# role and a database named "socverse" if neither already exists. Harmless no-ops on the
# environments where both already exist as the real superuser/database; on Railway this creates
# an unused placeholder role and an empty, unused placeholder database purely so those two
# migrations' hardcoded references resolve to *something* valid.
cat <<SQL | npx prisma db execute --url "$MIGRATE_DATABASE_URL" --stdin
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'socverse') THEN
    CREATE ROLE "socverse";
  END IF;
END
\$\$;
SQL
cat <<SQL | npx prisma db execute --url "$MIGRATE_DATABASE_URL" --stdin || true
CREATE DATABASE "socverse";
SQL

npx prisma migrate deploy --schema "$SCHEMA_PATH"

: "${APP_DB_PASSWORD:?APP_DB_PASSWORD must be set so socverse_app's password can be rotated off the migration's built-in default}"

ESCAPED_PASSWORD=$(printf '%s' "$APP_DB_PASSWORD" | sed "s/'/''/g")
cat <<SQL | npx prisma db execute --url "$MIGRATE_DATABASE_URL" --stdin
ALTER ROLE "socverse_app" WITH PASSWORD '$ESCAPED_PASSWORD';
SQL

echo "socverse_app password provisioned from APP_DB_PASSWORD."
