-- New column on an existing table: inherits the table's existing grant to socverse_app, no
-- explicit GRANT needed here.
ALTER TABLE "cohort_scenario_assignments" ADD COLUMN "removed_at" TIMESTAMP(3);
