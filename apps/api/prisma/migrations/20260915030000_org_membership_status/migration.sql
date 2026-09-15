-- CreateEnum
CREATE TYPE "OrgMembershipStatus" AS ENUM ('active', 'suspended');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "org_membership_status" "OrgMembershipStatus" NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "org_joined_at" TIMESTAMP(3);
