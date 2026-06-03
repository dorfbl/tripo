-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('OPEN', 'VOTING', 'DECIDED');

-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('YES_NO', 'SINGLE_CHOICE', 'MANUAL');

-- CreateEnum
CREATE TYPE "DecisionCategory" AS ENUM ('DESTINATION', 'DATES', 'HOTEL', 'TRANSPORT', 'ACTIVITY', 'BUDGET', 'OTHER');

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "DecisionCategory" NOT NULL DEFAULT 'OTHER',
    "status" "DecisionStatus" NOT NULL DEFAULT 'OPEN',
    "type" "DecisionType" NOT NULL,
    "finalDecision" TEXT,
    "finalOptionId" TEXT,
    "dueDate" TIMESTAMP(3),
    "actionNote" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionOption" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionVote" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DecisionVote_decisionId_userId_key" ON "DecisionVote"("decisionId", "userId");

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionOption" ADD CONSTRAINT "DecisionOption_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionVote" ADD CONSTRAINT "DecisionVote_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionVote" ADD CONSTRAINT "DecisionVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "DecisionOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionVote" ADD CONSTRAINT "DecisionVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
