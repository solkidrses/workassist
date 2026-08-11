import { prisma } from '@/lib/prisma';
import { authorizeRequest, TELEGRAM_AUTH_ERROR } from '@/lib/requestAuth';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
};

export async function GET(req: Request) {
  try {
    const auth = await authorizeRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR, code: auth.code }, { status: 403 });
    }

    const rows = await prisma.$queryRaw<ChatSession[]>`
      SELECT id, title, "createdAt"
      FROM chat_sessions
      WHERE "telegramId" = ${auth.user!.telegramId}
      ORDER BY "createdAt" DESC
      LIMIT 50
    `;

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Chat sessions GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await authorizeRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR, code: auth.code }, { status: 403 });
    }

    const { title } = (await req.json().catch(() => ({}))) as { title?: string };
    const id = crypto.randomUUID();
    const sessionTitle = (title || 'Новый чат').substring(0, 60);

    await prisma.$executeRaw`INSERT INTO chat_sessions (id, title, "telegramId", "createdAt") VALUES (${id}, ${sessionTitle}, ${auth.user!.telegramId}, NOW())`;

    return NextResponse.json({ success: true, data: { id, title: sessionTitle } });
  } catch (error) {
    console.error('Chat session POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
