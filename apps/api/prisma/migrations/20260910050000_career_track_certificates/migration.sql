-- Career-track (Course-level) certificates + public shareable ids.
-- Existing rows are path-level certificates: they keep learning_path_id, get a
-- generated public_id, and course_id stays NULL so they don't collide on the new
-- (user_id, course_id) unique.

-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_learning_path_id_fkey";

-- DropIndex
DROP INDEX "certificates_user_id_learning_path_id_key";

-- AlterTable: new columns nullable first
ALTER TABLE "certificates"
  ADD COLUMN "course_id" UUID,
  ADD COLUMN "public_id" TEXT,
  ALTER COLUMN "learning_path_id" DROP NOT NULL;

-- Backfill public_id for rows issued before this migration. TL-<year>-<8 hex>.
UPDATE "certificates"
SET "public_id" = 'TL-' || to_char("issued_at", 'YYYY') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))
WHERE "public_id" IS NULL;

-- Now enforce.
ALTER TABLE "certificates" ALTER COLUMN "public_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "certificates_public_id_key" ON "certificates"("public_id");
CREATE INDEX "certificates_public_id_idx" ON "certificates"("public_id");
CREATE UNIQUE INDEX "certificates_user_id_course_id_key" ON "certificates"("user_id", "course_id");

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_learning_path_id_fkey" FOREIGN KEY ("learning_path_id") REFERENCES "learning_paths"("id") ON DELETE SET NULL ON UPDATE CASCADE;
