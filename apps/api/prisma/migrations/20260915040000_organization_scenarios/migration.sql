-- CreateTable
CREATE TABLE "organization_scenarios" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "scenario_id" UUID NOT NULL,
    "due_at" TIMESTAMP(3),
    "added_by" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "organization_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_scenario_assignments" (
    "id" UUID NOT NULL,
    "organization_scenario_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_scenario_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_scenarios_org_id_idx" ON "organization_scenarios"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_scenarios_org_id_scenario_id_key" ON "organization_scenarios"("org_id", "scenario_id");

-- CreateIndex
CREATE INDEX "organization_scenario_assignments_user_id_idx" ON "organization_scenario_assignments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_scenario_assignments_organization_scenario_id__key" ON "organization_scenario_assignments"("organization_scenario_id", "user_id");

-- AddForeignKey
ALTER TABLE "organization_scenarios" ADD CONSTRAINT "organization_scenarios_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_scenarios" ADD CONSTRAINT "organization_scenarios_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "attack_scenarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_scenarios" ADD CONSTRAINT "organization_scenarios_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_scenario_assignments" ADD CONSTRAINT "organization_scenario_assignments_organization_scenario_id_fkey" FOREIGN KEY ("organization_scenario_id") REFERENCES "organization_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_scenario_assignments" ADD CONSTRAINT "organization_scenario_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Grant: new tables need an explicit grant because Railway's ALTER DEFAULT PRIVILEGES
-- auto-grant does not apply (migrations run as the `postgres`/`socverse` owner role, not the
-- app's own least-privilege `socverse_app` role) — see 20260827130000_grant_timeline_items_to_app_role.
GRANT SELECT, INSERT, UPDATE, DELETE ON "organization_scenarios" TO "socverse_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON "organization_scenario_assignments" TO "socverse_app";
