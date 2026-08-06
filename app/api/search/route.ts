import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { isAuthorizedRequest, TELEGRAM_AUTH_ERROR } from '@/lib/requestAuth';

type SearchResultRow = {
  id: string;
  title: string;
  summary: string;
  tag: string;
  createdAt: string;
  similarity?: number;
};

const openai = new OpenAI({ apiKey: process.env.EMBEDDINGS_API_KEY || 'dummy_key' });

export async function GET(req: Request) {
  try {
    if (!isAuthorizedRequest(req)) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    let hasEmbeddingsKey = process.env.EMBEDDINGS_API_KEY && process.env.EMBEDDINGS_API_KEY !== 'dummy_key';
    
    let results: SearchResultRow[] = [];

    if (hasEmbeddingsKey) {
      try {
        // Generate embedding for query
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: query,
        });
        const embedding = embeddingResponse.data[0].embedding;
        const embeddingStr = `[${embedding.join(',')}]`;

        // Semantic search
        const rawResults = await prisma.$queryRaw<SearchResultRow[]>`
          SELECT id, title, summary, tag, "createdAt", 
          1 - (embedding <=> ${embeddingStr}::vector) as similarity
          FROM instructions
          ORDER BY embedding <=> ${embeddingStr}::vector ASC
          LIMIT 10
        `;
        results = rawResults;
      } catch (e) {
        console.error("Embedding search failed, falling back to text search", e);
        hasEmbeddingsKey = false;
      }
    }

    if (!hasEmbeddingsKey) {
      // Basic text search fallback
      const ILIKE = `%${query}%`;
      const rawResults = await prisma.$queryRaw<SearchResultRow[]>`
        SELECT id, title, summary, tag, "createdAt"
        FROM instructions
        WHERE title ILIKE ${ILIKE} OR summary ILIKE ${ILIKE} OR "fullText" ILIKE ${ILIKE}
        LIMIT 10
      `;
      results = rawResults.map((result) => ({ ...result, similarity: 0.5 }));
    }

    return NextResponse.json({ success: true, data: results });

  } catch (error) {
    console.error('Search Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
