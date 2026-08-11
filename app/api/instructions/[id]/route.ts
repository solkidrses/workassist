import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeRequest, requireAdmin, TELEGRAM_AUTH_ERROR } from '@/lib/requestAuth';
import OpenAI from 'openai';
import { unlink } from 'fs/promises';
import path from 'path';

type InstructionRow = {
  id: string;
  title: string;
  summary: string;
  fullText: string;
  tag: string;
  sourceType: string;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type InstructionUpdateRow = {
  id: string;
  title: string;
  summary: string;
  fullText: string;
  tag: string;
  updatedAt: string;
};

// GET /api/instructions/[id]
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authorizeRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR, code: auth.code }, { status: 403 });
    }

    const { id } = await params;

    const results = await prisma.$queryRaw<InstructionRow[]>`
      SELECT id, title, summary, "fullText", tag, "sourceType", "photoUrl", "createdAt", "updatedAt"
      FROM instructions
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!results || results.length === 0) {
      return NextResponse.json({ error: 'Instruction not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: results[0] });
  } catch (error) {
    console.error('Fetch Instruction Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/instructions/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminCheck = await requireAdmin(req);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const { id } = await params;
    const body = await req.json();
    const { title, summary, fullText, tag } = body;

    const MAX_TITLE = 200;
    const MAX_SUMMARY = 1000;
    const MAX_FULLTEXT = 100_000;
    const MAX_TAG = 50;

    if (title && title.length > MAX_TITLE) {
      return NextResponse.json({ error: `Title too long (max ${MAX_TITLE} chars)` }, { status: 400 });
    }
    if (summary && summary.length > MAX_SUMMARY) {
      return NextResponse.json({ error: `Summary too long (max ${MAX_SUMMARY} chars)` }, { status: 400 });
    }
    if (fullText && fullText.length > MAX_FULLTEXT) {
      return NextResponse.json({ error: `Text too long (max ${MAX_FULLTEXT} chars)` }, { status: 400 });
    }
    if (tag && tag.length > MAX_TAG) {
      return NextResponse.json({ error: `Tag too long (max ${MAX_TAG} chars)` }, { status: 400 });
    }

    // Regenerate embedding if text fields changed and API key is available
    const hasEmbeddingsKey = process.env.EMBEDDINGS_API_KEY && process.env.EMBEDDINGS_API_KEY !== 'dummy_key';
    let embeddingStr: string | null = null;

    if (hasEmbeddingsKey && (title || summary || fullText)) {
      try {
        const openai = new OpenAI({ apiKey: process.env.EMBEDDINGS_API_KEY! });
        const embeddingInput = `${summary || ''}\n\n${fullText || ''}`;
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: embeddingInput,
        });
        const embedding = embeddingResponse.data[0].embedding;
        embeddingStr = `[${embedding.join(',')}]`;
      } catch (e) {
        console.error('Embedding update error:', e);
      }
    }

    if (embeddingStr) {
      await prisma.$executeRawUnsafe(
        `UPDATE instructions SET title = $1, summary = $2, "fullText" = $3, tag = $4, embedding = $5::vector, "updatedAt" = NOW() WHERE id = $6`,
        title || 'Untitled', summary || '', fullText || '', tag || 'general', embeddingStr, id
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE instructions SET title = $1, summary = $2, "fullText" = $3, tag = $4, "updatedAt" = NOW() WHERE id = $5`,
        title || 'Untitled', summary || '', fullText || '', tag || 'general', id
      );
    }

    const updated = await prisma.$queryRaw<InstructionUpdateRow[]>`
      SELECT id, title, summary, "fullText", tag, "updatedAt"
      FROM instructions WHERE id = ${id}
    `;

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Update Instruction Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/instructions/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminCheck = await requireAdmin(req);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const { id } = await params;

    // Get photoUrl before deleting so we can clean up the file
    const rows = await prisma.$queryRaw<{ photoUrl: string | null }[]>`
      SELECT "photoUrl" FROM instructions WHERE id = ${id}
    `;
    const photoUrl = rows[0]?.photoUrl;

    await prisma.$queryRaw`
      DELETE FROM instructions
      WHERE id = ${id}
    `;

    // Delete photo file from disk if it exists
    if (photoUrl) {
      const filename = photoUrl.split('/').pop();
      if (filename) {
        const filePath = path.join(process.cwd(), 'public', 'uploads', filename);
        try {
          await unlink(filePath);
        } catch {
          // File may not exist, ignore
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Instruction Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
