-- Create extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "instructions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "fullText" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "photoUrl" TEXT,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instructions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "instructions_embedding_hnsw_idx" ON "instructions" USING hnsw (embedding vector_cosine_ops);
