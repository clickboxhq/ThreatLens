-- CreateEnum
CREATE TYPE "FileEventAction" AS ENUM ('created', 'modified', 'deleted', 'renamed', 'encrypted');

-- CreateEnum
CREATE TYPE "NetworkDirection" AS ENUM ('inbound', 'outbound');

-- CreateTable
CREATE TABLE "process_events" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "correlation_id" UUID,
    "raw" JSONB NOT NULL,
    "is_ground_truth_evidence" BOOLEAN NOT NULL DEFAULT false,
    "mitre_technique_id" UUID,
    "device_id" UUID NOT NULL,
    "process_guid" UUID NOT NULL,
    "parent_process_guid" UUID,
    "image_path" TEXT NOT NULL,
    "command_line" TEXT NOT NULL,
    "hash_sha256" TEXT NOT NULL,
    "parent_image_path" TEXT,
    "integrity_level" TEXT NOT NULL,
    "identity_id" UUID,

    CONSTRAINT "process_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_events" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "correlation_id" UUID,
    "raw" JSONB NOT NULL,
    "is_ground_truth_evidence" BOOLEAN NOT NULL DEFAULT false,
    "mitre_technique_id" UUID,
    "device_id" UUID NOT NULL,
    "action" "FileEventAction" NOT NULL,
    "file_path" TEXT NOT NULL,
    "hash_sha256" TEXT,
    "process_guid" UUID,

    CONSTRAINT "file_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_events" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "correlation_id" UUID,
    "raw" JSONB NOT NULL,
    "is_ground_truth_evidence" BOOLEAN NOT NULL DEFAULT false,
    "mitre_technique_id" UUID,
    "device_id" UUID NOT NULL,
    "direction" "NetworkDirection" NOT NULL,
    "protocol" TEXT NOT NULL,
    "local_port" INTEGER NOT NULL,
    "remote_ip" TEXT NOT NULL,
    "remote_port" INTEGER NOT NULL,
    "bytes_sent" INTEGER NOT NULL,
    "bytes_received" INTEGER NOT NULL,
    "process_guid" UUID,

    CONSTRAINT "network_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "process_events_session_id_device_id_idx" ON "process_events"("session_id", "device_id");

-- CreateIndex
CREATE INDEX "file_events_session_id_device_id_idx" ON "file_events"("session_id", "device_id");

-- CreateIndex
CREATE INDEX "network_events_session_id_device_id_idx" ON "network_events"("session_id", "device_id");

-- AddForeignKey
ALTER TABLE "process_events" ADD CONSTRAINT "process_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "investigation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_events" ADD CONSTRAINT "process_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "process_events" ADD CONSTRAINT "process_events_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_events" ADD CONSTRAINT "file_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "investigation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_events" ADD CONSTRAINT "file_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_events" ADD CONSTRAINT "network_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "investigation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_events" ADD CONSTRAINT "network_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
