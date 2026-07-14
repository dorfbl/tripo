-- Create new unified tables

-- 1. Place table (unified source for all places/activities)
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "emoji" TEXT NOT NULL DEFAULT '📌',
    "color" TEXT NOT NULL DEFAULT 'blue',
    "location" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "placeId" TEXT,
    "openingHours" JSONB,
    "mapsUrl" TEXT,
    "url" TEXT,
    "cost" TEXT,
    "durationMins" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- 2. PlacePhoto table (drop old one first if exists, then create new)
DROP TABLE IF EXISTS "PlacePhoto" CASCADE;
CREATE TABLE "PlacePhoto" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacePhoto_pkey" PRIMARY KEY ("id")
);

-- 3. PlaceFile table
CREATE TABLE "PlaceFile" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "size" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaceFile_pkey" PRIMARY KEY ("id")
);

-- 4. PlaceVote table
CREATE TABLE "PlaceVote" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaceVote_pkey" PRIMARY KEY ("id")
);

-- 5. ScheduledEvent table (calendar/planner)
CREATE TABLE "ScheduledEvent" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "placeId" TEXT,
    "date" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL DEFAULT 0,
    "durationMins" INTEGER NOT NULL DEFAULT 60,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "notes" TEXT,
    "color" TEXT,
    "openingHoursWarning" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledEvent_pkey" PRIMARY KEY ("id")
);

-- 6. ScheduledEventFile table
CREATE TABLE "ScheduledEventFile" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "size" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledEventFile_pkey" PRIMARY KEY ("id")
);

-- 7. MapPoint table (map order/route)
CREATE TABLE "MapPoint" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "date" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MapPoint_pkey" PRIMARY KEY ("id")
);

-- Add indexes
CREATE INDEX "Place_tripId_idx" ON "Place"("tripId");
CREATE INDEX "Place_tripId_name_idx" ON "Place"("tripId", "name");
CREATE INDEX "Place_tripId_category_idx" ON "Place"("tripId", "category");
CREATE INDEX "Place_placeId_idx" ON "Place"("placeId");

CREATE INDEX "PlacePhoto_placeId_idx" ON "PlacePhoto"("placeId");
CREATE INDEX "PlaceFile_placeId_idx" ON "PlaceFile"("placeId");

CREATE UNIQUE INDEX "PlaceVote_placeId_userId_key" ON "PlaceVote"("placeId", "userId");
CREATE INDEX "PlaceVote_tripId_idx" ON "PlaceVote"("tripId");

CREATE INDEX "ScheduledEvent_tripId_date_idx" ON "ScheduledEvent"("tripId", "date");
CREATE INDEX "ScheduledEvent_placeId_idx" ON "ScheduledEvent"("placeId");
CREATE INDEX "ScheduledEventFile_eventId_idx" ON "ScheduledEventFile"("eventId");

CREATE UNIQUE INDEX "MapPoint_tripId_placeId_date_key" ON "MapPoint"("tripId", "placeId", "date");
CREATE INDEX "MapPoint_tripId_date_order_idx" ON "MapPoint"("tripId", "date", "order");
CREATE INDEX "MapPoint_placeId_idx" ON "MapPoint"("placeId");

-- Add foreign keys
ALTER TABLE "Place" ADD CONSTRAINT "Place_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlacePhoto" ADD CONSTRAINT "PlacePhoto_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaceFile" ADD CONSTRAINT "PlaceFile_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaceVote" ADD CONSTRAINT "PlaceVote_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledEvent" ADD CONSTRAINT "ScheduledEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledEvent" ADD CONSTRAINT "ScheduledEvent_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduledEventFile" ADD CONSTRAINT "ScheduledEventFile_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ScheduledEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MapPoint" ADD CONSTRAINT "MapPoint_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MapPoint" ADD CONSTRAINT "MapPoint_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;
