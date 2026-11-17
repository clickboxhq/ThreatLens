-- The population ref each narrative identity/device was generated from, so a scenario's
-- containment_expectations can name a target by ref ("victim_device_1") and the Scoring
-- Engine can resolve it to the row it became. Nullable: decoy rows have no ref.
ALTER TABLE "identities" ADD COLUMN "narrative_ref" TEXT;
ALTER TABLE "devices" ADD COLUMN "narrative_ref" TEXT;
