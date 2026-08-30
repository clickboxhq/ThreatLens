-- Investigation checklist completion state (Sentinel-style incident tasks).
-- Task definitions live in code and are derived from the scenario category; only which
-- steps the analyst ticked is per-incident, so this is a key set rather than duplicated rows.
ALTER TABLE "incidents"
  ADD COLUMN "completed_task_keys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
