import { streamText } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
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
    }
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
      model: deepseek('deepseek-chat'),
      system: systemPrompt,
      messages,
    });

    return result.toTextStreamResponse();

  } catch (error) {
    console.error('Chat Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
