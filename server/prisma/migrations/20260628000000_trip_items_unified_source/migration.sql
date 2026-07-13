CREATE TABLE "TripItem" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'activity',
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL DEFAULT 'other',
  "mapsUrl" TEXT,
  "url" TEXT,
  "location" TEXT,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "emoji" TEXT NOT NULL DEFAULT '📌',
  "color" TEXT NOT NULL DEFAULT 'blue',
  "cost" TEXT,
  "durationMins" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TripItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TripItem" ADD CONSTRAINT "TripItem_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TripPlace" ADD COLUMN IF NOT EXISTS "itemId" TEXT;
ALTER TABLE "PlannerActivity" ADD COLUMN IF NOT EXISTS "itemId" TEXT;
ALTER TABLE "PlannerEvent" ADD COLUMN IF NOT EXISTS "itemId" TEXT;

ALTER TABLE "TripPlace" ADD CONSTRAINT "TripPlace_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "TripItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlannerActivity" ADD CONSTRAINT "PlannerActivity_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "TripItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlannerEvent" ADD CONSTRAINT "PlannerEvent_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "TripItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TripItem_tripId_idx" ON "TripItem"("tripId");
CREATE INDEX "TripItem_tripId_name_idx" ON "TripItem"("tripId", "name");
CREATE INDEX "TripItem_tripId_mapsUrl_idx" ON "TripItem"("tripId", "mapsUrl");
CREATE INDEX "TripPlace_itemId_idx" ON "TripPlace"("itemId");
CREATE INDEX "PlannerActivity_itemId_idx" ON "PlannerActivity"("itemId");
CREATE INDEX "PlannerEvent_itemId_idx" ON "PlannerEvent"("itemId");
