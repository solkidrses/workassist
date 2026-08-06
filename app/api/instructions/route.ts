import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthorizedRequest, TELEGRAM_AUTH_ERROR } from '@/lib/requestAuth';

export async function GET(req: Request) {
  try {
    if (!isAuthorizedRequest(req)) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tag = searchParams.get('tag');

    const results = tag
      ? await prisma.$queryRaw`
          SELECT id, title, summary, tag, "createdAt", "sourceType"
          FROM instructions
          WHERE tag = ${tag}
          ORDER BY "createdAt" DESC
          LIMIT 50
        `
      : await prisma.$queryRaw`
          SELECT id, title, summary, tag, "createdAt", "sourceType"
          FROM instructions
          ORDER BY "createdAt" DESC
          LIMIT 50
        `;

    return NextResponse.json({ success: true, data: results });

  } catch (error) {
    console.error('List Instructions Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
