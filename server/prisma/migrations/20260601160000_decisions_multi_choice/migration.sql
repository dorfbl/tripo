-- Add MULTI_CHOICE to existing enum first (PostgreSQL allows adding values)
ALTER TYPE "DecisionType" ADD VALUE IF NOT EXISTS 'MULTI_CHOICE';

-- Migrate any MANUAL decisions to SINGLE_CHOICE (keep them valid)
UPDATE "Decision" SET "type" = 'SINGLE_CHOICE' WHERE "type" = 'MANUAL';

-- Now replace enum: create new without MANUAL
CREATE TYPE "DecisionType_new" AS ENUM ('YES_NO', 'SINGLE_CHOICE', 'MULTI_CHOICE');
ALTER TABLE "Decision" ALTER COLUMN "type" TYPE "DecisionType_new" USING "type"::text::"DecisionType_new";
DROP TYPE "DecisionType";
ALTER TYPE "DecisionType_new" RENAME TO "DecisionType";

-- Replace unique constraint [decisionId, userId] → [decisionId, optionId, userId]
DROP INDEX IF EXISTS "DecisionVote_decisionId_userId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "DecisionVote_decisionId_optionId_userId_key" ON "DecisionVote"("decisionId", "optionId", "userId");
