import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorizedRequest, TELEGRAM_AUTH_ERROR } from '@/lib/requestAuth';
import OpenAI from 'openai';

type InstructionRow = {
  id: string;
  title: string;
  summary: string;
  fullText: string;
};

export async function GET(req: Request) {
  try {
    if (!isAuthorizedRequest(req)) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR }, { status: 401 });
    }

    const hasEmbeddingsKey = process.env.EMBEDDINGS_API_KEY && process.env.EMBEDDINGS_API_KEY !== 'dummy_key';

    const total = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM instructions`;
    const withoutEmbedding = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM instructions WHERE embedding IS NULL`;
    const totalChats = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM chat_sessions`;
    const totalMessages = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM chat_messages`;
    const totalCategories = await prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM categories`;

    return NextResponse.json({
      success: true,
      data: {
        totalInstructions: Number(total[0].count),
        withoutEmbedding: Number(withoutEmbedding[0].count),
        embeddingsEnabled: !!hasEmbeddingsKey,
        totalSessions: Number(totalChats[0].count),
        totalMessages: Number(totalMessages[0].count),
        totalCategories: Number(totalCategories[0].count),
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!isAuthorizedRequest(req)) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR }, { status: 401 });
    }

    const hasEmbeddingsKey = process.env.EMBEDDINGS_API_KEY && process.env.EMBEDDINGS_API_KEY !== 'dummy_key';
    if (!hasEmbeddingsKey) {
      return NextResponse.json({ error: 'EMBEDDINGS_API_KEY not configured' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.EMBEDDINGS_API_KEY! });

    const { searchParams } = new URL(req.url);
    const onlyMissing = searchParams.get('onlyMissing') === 'true';

    const instructions = onlyMissing
      ? await prisma.$queryRaw<InstructionRow[]>`
          SELECT id, title, summary, "fullText" FROM instructions WHERE embedding IS NULL
        `
      : await prisma.$queryRaw<InstructionRow[]>`
          SELECT id, title, summary, "fullText" FROM instructions
        `;

    let updated = 0;
    let failed = 0;

    for (const inst of instructions) {
      try {
        const embeddingInput = `${inst.summary}\n\n${inst.fullText}`;
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: embeddingInput,
        });
        const embedding = embeddingResponse.data[0].embedding;
        const embeddingStr = `[${embedding.join(',')}]`;

        await prisma.$executeRawUnsafe(
          `UPDATE instructions SET embedding = $1::vector WHERE id = $2`,
          embeddingStr, inst.id
        );
        updated++;
      } catch (e) {
        console.error(`Failed to update embedding for ${inst.id}:`, e);
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      data: { total: instructions.length, updated, failed },
    });
  } catch (error) {
    console.error('Regenerate embeddings error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
