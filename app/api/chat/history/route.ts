import { prisma } from '@/lib/prisma';
import { isAuthorizedRequest, TELEGRAM_AUTH_ERROR } from '@/lib/requestAuth';
import { NextResponse } from 'next/server';

type ChatHistoryRow = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

export async function GET(req: Request) {
  try {
    if (!isAuthorizedRequest(req)) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

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

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Chat history GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    if (!isAuthorizedRequest(req)) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (sessionId) {
      await prisma.$executeRaw`DELETE FROM chat_messages WHERE "sessionId" = ${sessionId}`;
      await prisma.$executeRaw`DELETE FROM chat_sessions WHERE id = ${sessionId}`;
    } else {
      await prisma.$executeRaw`DELETE FROM chat_messages`;
      await prisma.$executeRaw`DELETE FROM chat_sessions`;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Chat history DELETE error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
