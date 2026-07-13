-- CreateTable
CREATE TABLE "PlanConfig" (
    "id" TEXT NOT NULL,
    "nameHe" TEXT NOT NULL,
    "maxTrips" INTEGER NOT NULL,
    "maxMembersPerTrip" INTEGER NOT NULL,
    "maxAiCallsPerMonth" INTEGER NOT NULL,
    "maxStorageBytes" BIGINT NOT NULL,
    "aiIncluded" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanConfig_pkey" PRIMARY KEY ("id")
);

