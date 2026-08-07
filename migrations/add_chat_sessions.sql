CREATE TABLE IF NOT EXISTS "chat_sessions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;

UPDATE instructions
SET "photoUrl" = REPLACE("photoUrl", '/uploads/', '/api/photos/')
WHERE "photoUrl" LIKE '/uploads/%';
