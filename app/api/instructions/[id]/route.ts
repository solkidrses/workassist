import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorizedRequest, TELEGRAM_AUTH_ERROR } from '@/lib/requestAuth';

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
    if (!isAuthorizedRequest(req)) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR }, { status: 401 });
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
    if (!isAuthorizedRequest(req)) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { title, summary, fullText, tag } = body;

    const updated = await prisma.$queryRaw<InstructionUpdateRow[]>`
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

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Update Instruction Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/instructions/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isAuthorizedRequest(req)) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR }, { status: 401 });
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
