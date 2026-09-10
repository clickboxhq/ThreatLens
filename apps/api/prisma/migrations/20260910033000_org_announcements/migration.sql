-- AlterEnum
ALTER TYPE "NotificationCategory" ADD VALUE 'announcement';

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "cohort_id" UUID,
    "author_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "recipient_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcements_org_id_created_at_idx" ON "announcements"("org_id", "created_at");

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_cohort_id_fkey" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- §15.9: the running app connects as the least-privilege `socverse_app` role. Per
-- 20260827130000_grant_timeline_items_to_app_role, the ALTER DEFAULT PRIVILEGES auto-grant
-- from 20260806001500 silently does NOT apply on Railway (migrations run there as `postgres`,
-- not `socverse`), so a new table needs an explicit grant or the app hits 42501 in production.
GRANT SELECT, INSERT, UPDATE, DELETE ON "announcements" TO "socverse_app";
