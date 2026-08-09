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

        // Semantic search with threshold
        const rawResults = await prisma.$queryRaw<SearchResultRow[]>`
          SELECT id, title, summary, tag, "createdAt", 
          1 - (embedding <=> ${embeddingStr}::vector) as similarity
          FROM instructions
          WHERE 1 - (embedding <=> ${embeddingStr}::vector) > 0.3
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
      // Keyword-based text search fallback with real similarity scoring
      const stopWords = new Set(['как', 'что', 'где', 'почему', 'зачем', 'чем', 'для', 'это', 'так', 'или', 'the', 'how', 'what', 'where', 'why']);
      const words = query.trim().split(/\s+/)
        .map(w => w.replace(/[^\wа-яё]/gi, '').toLowerCase())
        .filter(w => w.length > 2 && !stopWords.has(w));

      if (words.length === 0) {
        return NextResponse.json({ success: true, data: [] });
      }

      const allRows = await prisma.$queryRaw<(SearchResultRow & { fullText: string })[]>`
        SELECT id, title, summary, tag, "createdAt", "fullText"
        FROM instructions
      `;

      results = allRows
        .map((row) => {
          const title = row.title.toLowerCase();
          const summary = (row.summary || '').toLowerCase();
          const fullText = (row.fullText || '').toLowerCase();

          let score = 0;
          for (const w of words) {
            if (title.includes(w)) score += 1.0;
            else if (summary.includes(w)) score += 0.6;
            else if (fullText.includes(w)) score += 0.3;
          }

          return { ...row, similarity: Math.min(score / words.length, 1) };
        })
        .filter(r => r.similarity > 0)
        .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
        .slice(0, 10)
        .map(({ fullText: _ft, ...rest }) => rest);
    }

    return NextResponse.json({ success: true, data: results });

  } catch (error) {
    console.error('Search Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
