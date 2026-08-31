-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('new_to_security', 'early_career', 'experienced', 'career_switcher');

-- CreateEnum
CREATE TYPE "AvatarType" AS ENUM ('initials', 'preset', 'upload');

-- CreateEnum
CREATE TYPE "CareerLevel" AS ENUM ('l1', 'l2', 'senior');

-- AlterEnum
ALTER TYPE "NotificationCategory" ADD VALUE 'career_milestone';

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "industry" TEXT,
ADD COLUMN     "team_size" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_data_url" TEXT,
ADD COLUMN     "avatar_preset_key" TEXT,
ADD COLUMN     "avatar_type" "AvatarType" NOT NULL DEFAULT 'initials',
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "career_goal" TEXT,
ADD COLUMN     "career_level" "CareerLevel" NOT NULL DEFAULT 'l1',
ADD COLUMN     "experience_level" "ExperienceLevel",
ADD COLUMN     "first_name" TEXT,
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "professional_role" TEXT;
