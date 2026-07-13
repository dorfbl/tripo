-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'BUSINESS');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "plan" "PlanTier" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "planExpiresAt" TIMESTAMP(3),
ADD COLUMN     "storageBytesUsed" BIGINT NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UsageMonth" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "aiCalls" INTEGER NOT NULL DEFAULT 0,
    "storageBytesAdded" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageMonth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageMonth_userId_idx" ON "UsageMonth"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageMonth_userId_period_key" ON "UsageMonth"("userId", "period");

-- AddForeignKey
ALTER TABLE "UsageMonth" ADD CONSTRAINT "UsageMonth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

