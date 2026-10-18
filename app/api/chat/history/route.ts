import { prisma } from '@/lib/prisma';
import { authorizeRequest, TELEGRAM_AUTH_ERROR } from '@/lib/requestAuth';
import { NextResponse } from 'next/server';
import { signMarkdownPhotos } from '@/lib/photoSign';

type ChatHistoryRow = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

export async function GET(req: Request) {
  try {
    const auth = await authorizeRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR, code: auth.code }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    // If sessionId provided, verify ownership
    if (sessionId) {
      const ownerRows = await prisma.$queryRaw<{ telegramId: string | null }[]>`
        SELECT "telegramId" FROM chat_sessions WHERE id = ${sessionId} LIMIT 1
      `;
      if (ownerRows.length === 0) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
      const owner = ownerRows[0].telegramId;
      if (owner && owner !== auth.user!.telegramId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const rows = sessionId
      ? await prisma.$queryRaw<ChatHistoryRow[]>`
          SELECT id, role, content, "createdAt"
          FROM chat_messages
          WHERE "sessionId" = ${sessionId}
          ORDER BY "createdAt" ASC
          LIMIT 100
        `
      : await prisma.$queryRaw<ChatHistoryRow[]>`
          SELECT id, role, content, "createdAt"
          FROM chat_messages
          ORDER BY "createdAt" ASC
          LIMIT 100
        `;

    const signedRows = rows.map(r => ({
      ...r,
      content: r.role === 'assistant' ? signMarkdownPhotos(r.content) : r.content,
    }));

    return NextResponse.json({ success: true, data: signedRows });
  } catch (error) {
    console.error('Chat history GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await authorizeRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR, code: auth.code }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    // Verify ownership
    const ownerRows = await prisma.$queryRaw<{ telegramId: string | null }[]>`
      SELECT "telegramId" FROM chat_sessions WHERE id = ${sessionId} LIMIT 1
    `;
    if (ownerRows.length === 0) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    const owner = ownerRows[0].telegramId;
    if (owner && owner !== auth.user!.telegramId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await prisma.$executeRaw`DELETE FROM chat_messages WHERE "sessionId" = ${sessionId}`;
    await prisma.$executeRaw`DELETE FROM chat_sessions WHERE id = ${sessionId}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Chat history DELETE error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
