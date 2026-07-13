-- CreateTable
CREATE TABLE "TripFlight" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "flightDate" TIMESTAMP(3),
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "airline" TEXT,
    "departureAirport" TEXT,
    "arrivalAirport" TEXT,
    "departureAt" TIMESTAMP(3),
    "arrivalAt" TIMESTAMP(3),
    "notes" TEXT,
    "liveData" JSONB,
    "liveFetchedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripFlight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripFlight_tripId_idx" ON "TripFlight"("tripId");

-- CreateIndex
CREATE INDEX "TripFlight_tripId_flightNumber_idx" ON "TripFlight"("tripId", "flightNumber");

-- AddForeignKey
ALTER TABLE "TripFlight" ADD CONSTRAINT "TripFlight_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripFlight" ADD CONSTRAINT "TripFlight_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

