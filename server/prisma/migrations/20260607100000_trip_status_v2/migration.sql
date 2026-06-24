-- Rename old enum, create new one, migrate data, drop old
ALTER TYPE "TripStatus" RENAME TO "TripStatus_old";
CREATE TYPE "TripStatus" AS ENUM ('PLAN', 'LIVE', 'FINISHED', 'CANCELED');
ALTER TABLE "Trip" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Trip" ALTER COLUMN "status" TYPE "TripStatus" USING (
  CASE status::text
    WHEN 'ONGOING'   THEN 'LIVE'
    WHEN 'COMPLETED' THEN 'FINISHED'
    ELSE 'PLAN'
  END
)::"TripStatus";
ALTER TABLE "Trip" ALTER COLUMN "status" SET DEFAULT 'PLAN'::"TripStatus";
DROP TYPE "TripStatus_old";
