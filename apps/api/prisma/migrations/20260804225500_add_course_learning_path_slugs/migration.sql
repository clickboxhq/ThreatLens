-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "learning_paths" ADD COLUMN     "slug" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "learning_paths_slug_key" ON "learning_paths"("slug");

