#!/usr/bin/env sh
# Runs Prisma migrations, then rotates the least-privilege socverse_app role's password off
# the placeholder baked into prisma/migrations/20260806001500_add_least_privilege_app_role —
# that migration necessarily ships with a fixed dev password (Prisma migrations are
# forward-only, committed to the repo, and checksum-verified on every future `migrate deploy`,
# so they can never hold a real per-environment secret without breaking every environment that
# already applied them). This script is the actual fix: password rotation happens here, driven
# by APP_DB_PASSWORD, automatically on every deploy — not as a manual runbook step to remember.
#
# Used as the `migrate` service's command in infra/docker-compose.prod.yml. Safe to run
# repeatedly: `migrate deploy` is idempotent, and `ALTER ROLE ... PASSWORD` simply (re)sets the
# password to the same value if APP_DB_PASSWORD hasn't changed.
set -eu

npx prisma migrate deploy --schema apps/api/prisma/schema.prisma

: "${APP_DB_PASSWORD:?APP_DB_PASSWORD must be set so socverse_app's password can be rotated off the migration's built-in default}"

ESCAPED_PASSWORD=$(printf '%s' "$APP_DB_PASSWORD" | sed "s/'/''/g")
cat <<SQL | npx prisma db execute --url "$MIGRATE_DATABASE_URL" --stdin
ALTER ROLE "socverse_app" WITH PASSWORD '$ESCAPED_PASSWORD';
SQL

echo "socverse_app password provisioned from APP_DB_PASSWORD."
