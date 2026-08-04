import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { verifyTelegramInitData } from '@/lib/telegramAuth';
import { NextResponse } from 'next/server';

const openai = new OpenAI({ apiKey: process.env.EMBEDDINGS_API_KEY || 'dummy_key' });

export const maxDuration = 60; // Allow 60s for streaming

export async function POST(req: Request) {
  try {
    const initData = req.headers.get('x-telegram-init-data');
    if (!initData || !verifyTelegramInitData(initData, process.env.BOT_TOKEN!)) {
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage || lastMessage.role !== 'user') {
      return NextResponse.json({ error: 'Invalid messages array' }, { status: 400 });
    }

    // Embed user query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: lastMessage.content,
    });
    const embedding = embeddingResponse.data[0].embedding;
    const embeddingStr = `[${embedding.join(',')}]`;

    // Semantic search for RAG context
    const similar = await prisma.$queryRaw`
      SELECT id, title, summary, "fullText", tag, "createdAt", 
      (embedding <=> ${embeddingStr}::vector) as distance
      FROM instructions
      ORDER BY distance ASC
      LIMIT 5
    `;

    const results = similar as any[];
    let contextStr = '';
    
    if (results.length > 0) {
      contextStr = results.map(r => `[Title: ${r.title}, Tag: ${r.tag}]\n${r.fullText}`).join('\n\n---\n\n');
    }

    const systemPrompt = `You are an AI assistant helping a user with their personal work instructions database.
Your purpose is to answer the user's questions based ONLY on their uploaded workspace instructions.

Guidelines:
1. Always maintain a professional, technical, yet friendly tone.
2. Use the provided Context instructions to construct your answers.
3. If the retrieved context instructions contradict each other, call attention to this conflict immediately and detail both versions.
4. Reference the instructions you used by their exact Titles.
5. If no relevant instructions are found in the context, explicitly state: "В вашей базе инструкций нет информации по этому вопросу." Do not make up answers.
6. Support formatting using Markdown.

Context instructions:
${contextStr}
`;

    const result = await streamText({
      model: anthropic('claude-3-5-sonnet-20240620'),
      system: systemPrompt,
      messages,
    });

    return result.toTextStreamResponse();

  } catch (error) {
    console.error('Chat Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
