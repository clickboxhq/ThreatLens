-- Cohorts become a teaching space with multiple staff, optional groups, and group-scoped
-- assignments — rather than one instructor's private list keyed on cohorts.owner_id.
--
-- owner_id is kept as "who created it" and stops being the authorization key. Every existing
-- owner is backfilled as a `lead` staff member below, so permission checks can move to
-- cohort_staff without changing who can currently reach what.

CREATE TYPE "CohortStaffRole" AS ENUM ('lead', 'tutor', 'group_tutor');

-- Lets an org_admin see what is running under their organisation without being staffed onto
-- every cohort individually. Nullable: a cohort owned by an instructor with no organisation
-- (an individual account) legitimately has none.
ALTER TABLE "cohorts" ADD COLUMN "org_id" UUID;

ALTER TABLE "cohorts"
  ADD CONSTRAINT "cohorts_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "cohorts_org_id_idx" ON "cohorts"("org_id");

CREATE TABLE "cohort_staff" (
  "cohort_id" UUID NOT NULL,
  "user_id"   UUID NOT NULL,
  "role"      "CohortStaffRole" NOT NULL,
  "added_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "added_by"  UUID,
  CONSTRAINT "cohort_staff_pkey" PRIMARY KEY ("cohort_id", "user_id")
);

CREATE INDEX "cohort_staff_user_id_idx" ON "cohort_staff"("user_id");

ALTER TABLE "cohort_staff"
  ADD CONSTRAINT "cohort_staff_cohort_id_fkey"
  FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cohort_staff"
  ADD CONSTRAINT "cohort_staff_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "cohort_groups" (
  "id"         UUID NOT NULL,
  "cohort_id"  UUID NOT NULL,
  "name"       TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cohort_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cohort_groups_cohort_id_name_key" ON "cohort_groups"("cohort_id", "name");

ALTER TABLE "cohort_groups"
  ADD CONSTRAINT "cohort_groups_cohort_id_fkey"
  FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cohort_group_tutors" (
  "group_id" UUID NOT NULL,
  "user_id"  UUID NOT NULL,
  CONSTRAINT "cohort_group_tutors_pkey" PRIMARY KEY ("group_id", "user_id")
);

CREATE INDEX "cohort_group_tutors_user_id_idx" ON "cohort_group_tutors"("user_id");

ALTER TABLE "cohort_group_tutors"
  ADD CONSTRAINT "cohort_group_tutors_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "cohort_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cohort_group_tutors"
  ADD CONSTRAINT "cohort_group_tutors_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Which group a student sits in. Null = enrolled but not placed yet, which is the state every
-- existing enrollment starts in.
ALTER TABLE "cohort_enrollments" ADD COLUMN "group_id" UUID;

ALTER TABLE "cohort_enrollments"
  ADD CONSTRAINT "cohort_enrollments_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "cohort_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "cohort_enrollments_group_id_idx" ON "cohort_enrollments"("group_id");

-- Null = assigned to the whole cohort, which is what every existing assignment means. Set =
-- that group only, so a tutor can run a different track for their own students.
ALTER TABLE "cohort_scenario_assignments" ADD COLUMN "group_id" UUID;

ALTER TABLE "cohort_scenario_assignments"
  ADD CONSTRAINT "cohort_scenario_assignments_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "cohort_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "cohort_scenario_assignments_group_id_idx" ON "cohort_scenario_assignments"("group_id");

-- ---------------------------------------------------------------------------------------
-- Backfill. Both statements are the reason this migration is safe to run against live data:
-- without them, moving authorization from owner_id to cohort_staff would lock every existing
-- instructor out of their own cohort.
-- ---------------------------------------------------------------------------------------

-- Every current owner becomes a lead. added_by is null because no user performed this.
INSERT INTO "cohort_staff" ("cohort_id", "user_id", "role", "added_by")
SELECT "id", "owner_id", 'lead'::"CohortStaffRole", NULL
FROM "cohorts"
ON CONFLICT ("cohort_id", "user_id") DO NOTHING;

-- Attribute each cohort to its owner's organisation, where they have one.
UPDATE "cohorts" c
SET "org_id" = u."org_id"
FROM "users" u
WHERE u."id" = c."owner_id" AND u."org_id" IS NOT NULL;
