-- Create a session for orphaned messages (sessionId IS NULL)
INSERT INTO chat_sessions (id, title, "createdAt")
SELECT 'legacy-session-' || md5(random()::text), 'Старая переписка', MIN("createdAt")
FROM chat_messages
WHERE "sessionId" IS NULL;

-- Link orphaned messages to the new session
UPDATE chat_messages
SET "sessionId" = (
  SELECT id FROM chat_sessions WHERE title = 'Старая переписка' LIMIT 1
)
WHERE "sessionId" IS NULL;
