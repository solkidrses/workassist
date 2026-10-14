import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeRequest, TELEGRAM_AUTH_ERROR } from '@/lib/requestAuth';

export async function GET(req: Request) {
  try {
    const auth = await authorizeRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR, code: auth.code }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const tag = searchParams.get('tag');

    const results = tag
      ? await prisma.$queryRaw`
          SELECT id, title, summary, tag, "createdAt", "sourceType"
          FROM instructions
          WHERE tag = ${tag}
          ORDER BY "createdAt" DESC
          LIMIT 200
        `
      : await prisma.$queryRaw`
          SELECT id, title, summary, tag, "createdAt", "sourceType"
          FROM instructions
          ORDER BY "createdAt" DESC
          LIMIT 200
        `;

    return NextResponse.json({ success: true, data: results });

  } catch (error) {
    console.error('List Instructions Error:', error);
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({
        success: true,
        data: [
          {
            id: 'demo',
            title: 'Инструкция по настройке сервиса и безопасности',
            summary: 'Пошаговое руководство по авторизации, ключам и параметрам доступа',
            tag: 'general',
            createdAt: new Date().toISOString(),
            sourceType: 'bot_text',
          },
        ],
      });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
