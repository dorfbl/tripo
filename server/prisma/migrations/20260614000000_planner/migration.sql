CREATE TABLE "PlannerActivity" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "emoji" TEXT NOT NULL DEFAULT '📌',
  "location" TEXT,
  "description" TEXT,
  "durationMins" INTEGER NOT NULL DEFAULT 60,
  "cost" TEXT,
  "category" TEXT NOT NULL DEFAULT 'other',
  "mapsUrl" TEXT,
  "color" TEXT NOT NULL DEFAULT 'blue',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlannerActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlannerEvent" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "activityId" TEXT,
  "title" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "durationMins" INTEGER NOT NULL DEFAULT 60,
  "color" TEXT NOT NULL DEFAULT 'blue',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlannerEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PlannerActivity" ADD CONSTRAINT "PlannerActivity_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlannerEvent" ADD CONSTRAINT "PlannerEvent_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlannerEvent" ADD CONSTRAINT "PlannerEvent_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "PlannerActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
