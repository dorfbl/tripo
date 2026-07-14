-- Drop old tables that have been migrated to unified schema

-- Drop old activity/event tables
DROP TABLE IF EXISTS "PlannerEventFile" CASCADE;
DROP TABLE IF EXISTS "PlannerEvent" CASCADE;
DROP TABLE IF EXISTS "PlannerActivityFile" CASCADE;
DROP TABLE IF EXISTS "PlannerActivityVote" CASCADE;
DROP TABLE IF EXISTS "PlannerActivity" CASCADE;

-- Drop old TripItem table
DROP TABLE IF EXISTS "TripItem" CASCADE;

-- Drop old TripPlace table
DROP TABLE IF EXISTS "TripPlace" CASCADE;
