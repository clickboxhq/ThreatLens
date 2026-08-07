-- CreateTable
CREATE TABLE "timeline_items" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "event_table" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "added_by" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timeline_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "timeline_items_incident_id_event_table_event_id_key" ON "timeline_items"("incident_id", "event_table", "event_id");

-- AddForeignKey
ALTER TABLE "timeline_items" ADD CONSTRAINT "timeline_items_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_items" ADD CONSTRAINT "timeline_items_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
