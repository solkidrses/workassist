import { prisma } from '@/lib/prisma';
import { authorizeRequest, TELEGRAM_AUTH_ERROR } from '@/lib/requestAuth';
import { NextResponse } from 'next/server';

type ChatSessionRow = {
  id: string;
  title: string;
};

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR, code: auth.code }, { status: 403 });
    }

    const { id } = await params;
    const { title } = (await req.json().catch(() => ({}))) as { title?: string };

    if (title) {
      await prisma.$executeRaw`UPDATE chat_sessions SET title = ${title.substring(0, 60)} WHERE id = ${id}`;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Chat session PUT error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authorizeRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR, code: auth.code }, { status: 403 });
    }

    const { id } = await params;
    await prisma.$executeRaw`DELETE FROM chat_messages WHERE "sessionId" = ${id}`;
    await prisma.$executeRaw`DELETE FROM chat_sessions WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Chat session DELETE error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
