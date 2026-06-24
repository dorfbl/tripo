ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "ownerId" TEXT NOT NULL DEFAULT '';
UPDATE "Trip" t SET "ownerId" = (
  SELECT tm."userId" FROM "TripMember" tm
  WHERE tm."tripId" = t."id" AND tm."role" = 'ADMIN'
  ORDER BY tm."joinedAt" ASC
  LIMIT 1
) WHERE "ownerId" = '';
