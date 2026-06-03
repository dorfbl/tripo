-- Update any existing OPEN decisions to VOTING
UPDATE "Decision" SET status = 'VOTING' WHERE status = 'OPEN';

-- Drop the default so we can change the column type
ALTER TABLE "Decision" ALTER COLUMN status DROP DEFAULT;

-- Recreate enum without OPEN
ALTER TYPE "DecisionStatus" RENAME TO "DecisionStatus_old";
CREATE TYPE "DecisionStatus" AS ENUM ('VOTING', 'DECIDED');
ALTER TABLE "Decision" ALTER COLUMN status TYPE "DecisionStatus" USING status::text::"DecisionStatus";
DROP TYPE "DecisionStatus_old";

-- Restore the default
ALTER TABLE "Decision" ALTER COLUMN status SET DEFAULT 'VOTING';
