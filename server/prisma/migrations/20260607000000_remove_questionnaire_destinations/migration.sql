-- Drop questionnaire and destinations tables
DROP TABLE IF EXISTS "DestinationVote";
DROP TABLE IF EXISTS "SuggestedDestination";
DROP TABLE IF EXISTS "QuestionAnswer";
DROP TABLE IF EXISTS "Question";
DROP TYPE IF EXISTS "QuestionType";
ALTER TABLE "TripMember" DROP COLUMN IF EXISTS "completedQuestionnaire";
