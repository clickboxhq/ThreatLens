-- CreateEnum
CREATE TYPE "CloudProvider" AS ENUM ('aws_style', 'azure_style', 'saas');

-- CreateTable
CREATE TABLE "cloud_events" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "correlation_id" UUID,
    "raw" JSONB NOT NULL,
    "is_ground_truth_evidence" BOOLEAN NOT NULL DEFAULT false,
    "mitre_technique_id" UUID,
    "identity_id" UUID NOT NULL,
    "provider" "CloudProvider" NOT NULL,
    "action_name" TEXT NOT NULL,
    "resource_id" TEXT,
    "source_ip" TEXT NOT NULL,

    CONSTRAINT "cloud_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "http_requests" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "correlation_id" UUID,
    "raw" JSONB NOT NULL,
    "is_ground_truth_evidence" BOOLEAN NOT NULL DEFAULT false,
    "mitre_technique_id" UUID,
    "device_id" UUID,
    "identity_id" UUID,
    "method" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "source_ip" TEXT NOT NULL,

    CONSTRAINT "http_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cloud_events_session_id_identity_id_idx" ON "cloud_events"("session_id", "identity_id");

-- CreateIndex
CREATE INDEX "http_requests_session_id_device_id_idx" ON "http_requests"("session_id", "device_id");

-- AddForeignKey
ALTER TABLE "cloud_events" ADD CONSTRAINT "cloud_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "investigation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud_events" ADD CONSTRAINT "cloud_events_identity_id_fkey" FOREIGN KEY ("identity_id") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "http_requests" ADD CONSTRAINT "http_requests_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "investigation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "http_requests" ADD CONSTRAINT "http_requests_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
