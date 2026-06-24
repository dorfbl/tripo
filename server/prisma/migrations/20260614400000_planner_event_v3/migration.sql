ALTER TABLE "PlannerEvent" ADD COLUMN IF NOT EXISTS "mapsUrl" TEXT;

CREATE TABLE IF NOT EXISTS "PlannerEventFile" (
  "id"           TEXT NOT NULL,
  "eventId"      TEXT NOT NULL,
  "filename"     TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType"     TEXT NOT NULL DEFAULT 'application/octet-stream',
  "size"         INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlannerEventFile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PlannerEventFile" ADD CONSTRAINT "PlannerEventFile_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "PlannerEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
