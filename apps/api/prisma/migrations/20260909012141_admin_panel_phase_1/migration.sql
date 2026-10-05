-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('active', 'suspended');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "status" "OrgStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "suspended_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- §15.9: the running app connects as the least-privilege `socverse_app` role. Per
-- 20260827130000_grant_timeline_items_to_app_role, the ALTER DEFAULT PRIVILEGES auto-grant
-- from 20260806001500 silently does NOT apply on Railway (migrations run there as `postgres`,
-- not `socverse`), so a new table needs an explicit grant or the app hits 42501 in production.
GRANT SELECT, INSERT, UPDATE, DELETE ON "platform_settings" TO "socverse_app";
