CREATE TYPE "TripLinkType" AS ENUM ('FLIGHT', 'HOTEL', 'CAR', 'ACTIVITY', 'RESTAURANT', 'BAR', 'MAP', 'INSURANCE', 'DOCUMENT', 'PAYMENT', 'OTHER');
CREATE TYPE "TripLinkStatus" AS ENUM ('SAVED', 'PENDING', 'BOOKED', 'PAID', 'MISSING', 'CANCELLED');

CREATE TABLE "TripLink" (
    "id"                TEXT NOT NULL,
    "tripId"            TEXT NOT NULL,
    "title"             TEXT NOT NULL,
    "description"       TEXT,
    "url"               TEXT,
    "type"              "TripLinkType" NOT NULL DEFAULT 'OTHER',
    "status"            "TripLinkStatus" NOT NULL DEFAULT 'SAVED',
    "providerName"      TEXT,
    "startDate"         TIMESTAMP(3),
    "endDate"           TIMESTAMP(3),
    "estimatedCost"     DOUBLE PRECISION,
    "currency"          TEXT,
    "responsibleUserId" TEXT,
    "notes"             TEXT,
    "isPinned"          BOOLEAN NOT NULL DEFAULT false,
    "decisionId"        TEXT,
    "createdByUserId"   TEXT NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripLink_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TripLink" ADD CONSTRAINT "TripLink_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TripLink" ADD CONSTRAINT "TripLink_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
