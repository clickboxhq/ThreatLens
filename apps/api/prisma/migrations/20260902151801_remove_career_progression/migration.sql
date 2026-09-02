-- AlterEnum
CREATE TYPE "NotificationCategory_new" AS ENUM ('assignment', 'score_available', 'instructor_feedback', 'certificate_issued', 'org_invitation');
ALTER TABLE "notifications" ALTER COLUMN "category" TYPE "NotificationCategory_new" USING ("category"::text::"NotificationCategory_new");
ALTER TYPE "NotificationCategory" RENAME TO "NotificationCategory_old";
ALTER TYPE "NotificationCategory_new" RENAME TO "NotificationCategory";
DROP TYPE "NotificationCategory_old";
