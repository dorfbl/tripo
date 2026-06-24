CREATE TABLE IF NOT EXISTS "PlannerActivityVote" (
  "id"         TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "tripId"     TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "vote"       TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlannerActivityVote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PlannerActivityVote" ADD CONSTRAINT "PlannerActivityVote_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "PlannerActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "PlannerActivityVote_activityId_userId_key"
  ON "PlannerActivityVote"("activityId", "userId");

CREATE INDEX IF NOT EXISTS "PlannerActivityVote_tripId_idx"
  ON "PlannerActivityVote"("tripId");
