-- Retiring a cohort.
--
-- Deliberately archive rather than delete. cohort_enrollments and cohort_scenario_assignments
-- both reference cohorts without ON DELETE CASCADE, so PostgreSQL would refuse the delete
-- outright; and forcing a cascade would be worse, because investigation_sessions reference
-- cohort_scenario_assignments — a student's graded work and their certificate evidence hang
-- off the assignment they did it for. Retiring a class must not erase what its students did.
--
-- A timestamp rather than a boolean, so the record says when it happened.
ALTER TABLE "cohorts" ADD COLUMN "archived_at" TIMESTAMP(3);

-- Archived cohorts are filtered out of every active listing, which is the common query.
CREATE INDEX "cohorts_archived_at_idx" ON "cohorts"("archived_at");
