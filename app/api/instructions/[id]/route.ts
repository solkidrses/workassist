import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyTelegramInitData } from '@/lib/telegramAuth';

function checkAuth(req: Request) {
  const initData = req.headers.get('x-telegram-init-data');
  const botTokenHeader = req.headers.get('x-bot-token');
  
  if (botTokenHeader === process.env.BOT_TOKEN) return true;
  if (initData && verifyTelegramInitData(initData, process.env.BOT_TOKEN!)) return true;
  if (process.env.NODE_ENV !== 'production') return true;
  return false;
}

// GET /api/instructions/[id]
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const results = await prisma.$queryRaw`
      SELECT id, title, summary, "fullText", tag, "sourceType", "photoUrl", "createdAt", "updatedAt"
      FROM instructions
      WHERE id = ${id}
      LIMIT 1
    `;

    const instructions = results as any[];
    if (!instructions || instructions.length === 0) {
      return NextResponse.json({ error: 'Instruction not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: instructions[0] });
  } catch (error) {
    console.error('Fetch Instruction Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/instructions/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { title, summary, fullText, tag } = body;

    const updated = await prisma.$queryRaw`
      UPDATE instructions
      SET 
        title = ${title || 'Untitled'},
        summary = ${summary || ''},
        "fullText" = ${fullText || ''},
        tag = ${tag || 'general'},
        "updatedAt" = NOW()
      WHERE id = ${id}
      RETURNING id, title, summary, "fullText", tag, "updatedAt"
    `;

    return NextResponse.json({ success: true, data: (updated as any[])[0] });
  } catch (error) {
    console.error('Update Instruction Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/instructions/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!checkAuth(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await prisma.$queryRaw`
      DELETE FROM instructions
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Instruction Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
