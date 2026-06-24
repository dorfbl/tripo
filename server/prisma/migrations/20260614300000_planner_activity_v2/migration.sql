ALTER TABLE "PlannerActivity" ADD COLUMN IF NOT EXISTS "url" TEXT;

CREATE TABLE IF NOT EXISTS "PlannerActivityFile" (
  "id"           TEXT NOT NULL,
  "activityId"   TEXT NOT NULL,
  "filename"     TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType"     TEXT NOT NULL DEFAULT 'application/octet-stream',
  "size"         INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlannerActivityFile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PlannerActivityFile" ADD CONSTRAINT "PlannerActivityFile_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "PlannerActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
