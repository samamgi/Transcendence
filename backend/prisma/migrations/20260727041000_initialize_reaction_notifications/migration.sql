UPDATE "ConversationParticipant"
SET "lastSeenReactionAt" = CURRENT_TIMESTAMP
WHERE "lastSeenReactionAt" IS NULL;
