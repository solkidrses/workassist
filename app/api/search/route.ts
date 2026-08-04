import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { verifyTelegramInitData } from '@/lib/telegramAuth';

const openai = new OpenAI({ apiKey: process.env.EMBEDDINGS_API_KEY || 'dummy_key' });

export async function GET(req: Request) {
  try {
    const initData = req.headers.get('x-telegram-init-data');
    if (!initData || !verifyTelegramInitData(initData, process.env.BOT_TOKEN!)) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Generate embedding for query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    const embedding = embeddingResponse.data[0].embedding;
    const embeddingStr = `[${embedding.join(',')}]`;

    // Semantic search
    const results = await prisma.$queryRaw`
      SELECT id, title, summary, tag, "createdAt", 
      1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM instructions
      ORDER BY embedding <=> ${embeddingStr}::vector ASC
      LIMIT 10
    `;

    return NextResponse.json({ success: true, data: results });

  } catch (error) {
    console.error('Search Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
