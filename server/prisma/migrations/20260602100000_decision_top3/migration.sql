-- Add TOP3 to DecisionType enum
ALTER TYPE "DecisionType" ADD VALUE 'TOP3';

-- Add rank to DecisionVote for TOP3 ranked voting
ALTER TABLE "DecisionVote" ADD COLUMN "rank" INTEGER;
