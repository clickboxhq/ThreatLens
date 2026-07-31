-- AlterEnum
ALTER TYPE "InvestigationActionType" ADD VALUE 'request_hint';

-- CreateTable
CREATE TABLE "hint_unlocks" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "hint_index" INTEGER NOT NULL,
    "unlock_cost_percent" DECIMAL(5,2) NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hint_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hint_unlocks_session_id_hint_index_key" ON "hint_unlocks"("session_id", "hint_index");

-- AddForeignKey
ALTER TABLE "hint_unlocks" ADD CONSTRAINT "hint_unlocks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "investigation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
