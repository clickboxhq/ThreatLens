-- New column on an existing table: inherits the table's existing grant to socverse_app, no
-- explicit GRANT needed here.
ALTER TABLE "organizations" ADD COLUMN "deleted_at" TIMESTAMP(3);
