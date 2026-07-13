-- CreateEnum
CREATE TYPE "TimelineEventType" AS ENUM ('MEMBER_JOINED', 'DECISION_CLOSED', 'LINK_ADDED', 'PLACE_ADDED', 'EXPENSE_ADDED', 'PHOTO_UPLOADED', 'MEMORY');

-- AlterTable
ALTER TABLE "TripItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "type" "TimelineEventType" NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '📌',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimelineEvent_tripId_occurredAt_idx" ON "TimelineEvent"("tripId", "occurredAt");

-- CreateIndex
CREATE INDEX "TimelineEvent_tripId_category_idx" ON "TimelineEvent"("tripId", "category");

-- CreateIndex
CREATE INDEX "TimelineEvent_tripId_type_idx" ON "TimelineEvent"("tripId", "type");

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

