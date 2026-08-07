import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { isAuthorizedRequest, TELEGRAM_AUTH_ERROR } from '@/lib/requestAuth';
import { NextResponse } from 'next/server';

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

type RetrievedInstruction = {
  id: string;
  title: string;
  summary: string;
  fullText: string;
  tag: string;
  createdAt: string;
  distance?: number;
};

const openai = new OpenAI({ apiKey: process.env.EMBEDDINGS_API_KEY || 'dummy_key' });

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

export const maxDuration = 60; // Allow 60s for streaming

export async function POST(req: Request) {
  try {
    if (!isAuthorizedRequest(req)) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR }, { status: 401 });
    }

    const { messages } = await req.json() as { messages: ChatMessage[] };
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage || lastMessage.role !== 'user') {
      return NextResponse.json({ error: 'Invalid messages array' }, { status: 400 });
    }

    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: 'DEEPSEEK_API_KEY is not configured' }, { status: 500 });
    }

    let hasEmbeddingsKey = process.env.EMBEDDINGS_API_KEY && process.env.EMBEDDINGS_API_KEY !== 'dummy_key';
    let results: RetrievedInstruction[] = [];

    if (hasEmbeddingsKey) {
      try {
        // Embed user query
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: lastMessage.content,
        });
        const embedding = embeddingResponse.data[0].embedding;
        const embeddingStr = `[${embedding.join(',')}]`;

        // Semantic search for RAG context
        const similar = await prisma.$queryRaw<RetrievedInstruction[]>`
          SELECT id, title, summary, "fullText", tag, "createdAt", 
          (embedding <=> ${embeddingStr}::vector) as distance
          FROM instructions
          ORDER BY distance ASC
          LIMIT 5
        `;
        results = similar;
      } catch (e) {
        console.error("Embedding search failed in chat, falling back to text search", e);
        hasEmbeddingsKey = false;
      }
    }

    if (!hasEmbeddingsKey) {
      // Basic text search fallback using the user's message as query
      // Split message by space to get keywords, and search using ILIKE
      try {
        const query = lastMessage.content.trim();
        if (query.length > 2) {
          const ILIKE = `%${query}%`;
          const rawResults = await prisma.$queryRaw<RetrievedInstruction[]>`
            SELECT id, title, summary, "fullText", tag, "createdAt"
            FROM instructions
            WHERE title ILIKE ${ILIKE} OR summary ILIKE ${ILIKE} OR "fullText" ILIKE ${ILIKE}
            LIMIT 5
          `;
          results = rawResults;
        }
      } catch (e) {
        console.error('Text search failed in chat, continuing without context', e);
      }
    }
    let contextStr = '';
    
    if (results.length > 0) {
      contextStr = results.map(r => `[Title: ${r.title}, Tag: ${r.tag}]\n${r.fullText}`).join('\n\n---\n\n');
    }

    const instructions = `You are an AI assistant helping a user with their personal work instructions database.
Your purpose is to answer the user's questions based ONLY on the Context instructions provided in the user message.

Guidelines:
1. Always maintain a professional, technical, yet friendly tone.
2. Use the provided Context instructions to construct your answers.
3. If the retrieved context instructions contradict each other, call attention to this conflict immediately and detail both versions.
4. Reference the instructions you used by their exact Titles.
5. If no relevant instructions are found, explicitly state: "В вашей базе инструкций нет информации по этому вопросу." Do not make up answers.
6. Support formatting using Markdown.`;

    const contextSection = results.length > 0 ? `Context instructions:\n\n${contextStr}\n\n---\n\n` : '';
    const input = `${contextSection}User question: ${lastMessage.content}`;

    const deepseekClient = new OpenAI({ apiKey: DEEPSEEK_API_KEY, baseURL: DEEPSEEK_BASE_URL });

    const stream = await deepseekClient.responses.create({
      model: 'deepseek-v4-flash',
      instructions,
      input,
      stream: true,
    });

    const textStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const event of stream) {
          if ((event as { type: string }).type === 'response.output_text.delta') {
            controller.enqueue(encoder.encode((event as { delta: string }).delta));
          }
        }
        controller.close();
      },
    });

    return new NextResponse(textStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Chat Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
