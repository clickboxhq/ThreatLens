-- Nullable column on an existing table: no grant needed, inherits the table's existing grant.
ALTER TABLE "users" ADD COLUMN "last_meaningful_activity_at" TIMESTAMP(3);
