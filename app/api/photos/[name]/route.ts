import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/sessionCookie';
import { prisma } from '@/lib/prisma';

type StatusRow = { status: string };

export async function GET(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  const session = verifySession(req.headers.get('cookie'));
  if (!session.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const rows = await prisma.$queryRaw<StatusRow[]>`
      SELECT status FROM users WHERE "telegramId" = ${session.telegramId} LIMIT 1
    `;
    if (rows.length === 0 || rows[0].status !== 'approved') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (!/^[\w\-.]+$/.test(name)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), 'data', 'uploads', name);

  try {
    const buffer = await readFile(filePath);
    const ext = path.extname(name).toLowerCase();
    const contentType =
      ext === '.png' ? 'image/png' :
      ext === '.webp' ? 'image/webp' :
      ext === '.gif' ? 'image/gif' :
      'image/jpeg';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
