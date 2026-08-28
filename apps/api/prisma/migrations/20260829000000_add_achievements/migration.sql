-- CreateEnum
CREATE TYPE "AchievementKey" AS ENUM ('first_blood', 'perfect_score', 'sharpshooter', 'technique_master', 'verdict_veteran', 'no_hints_needed', 'category_explorer');

-- CreateTable
CREATE TABLE "achievements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "key" "AchievementKey" NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "achievements_user_id_key_key" ON "achievements"("user_id", "key");

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- §Phase 6: this table is new, so 20260827130000's default-privileges fix (whichever role
-- this migration itself runs as, "postgres" on Railway / "socverse" locally-CI) already covers
-- granting it to socverse_app — no manual GRANT needed, same as 20260828220000.
