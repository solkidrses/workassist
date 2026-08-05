import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyTelegramInitData } from '@/lib/telegramAuth';

export async function GET(req: Request) {
  try {
    const initData = req.headers.get('x-telegram-init-data');
    const botTokenHeader = req.headers.get('x-bot-token');
    
    let isAuthorized = false;
    
    if (botTokenHeader === process.env.BOT_TOKEN) {
      isAuthorized = true;
    } else if (initData && verifyTelegramInitData(initData, process.env.BOT_TOKEN!)) {
      isAuthorized = true;
    } else if (process.env.NODE_ENV !== 'production') {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tag = searchParams.get('tag');

    let whereClause = '';
    if (tag) {
      whereClause = `WHERE tag = '${tag.replace(/'/g, "''")}'`;
    }

    // Use raw query to avoid fetching embeddings which are large
    const results = await prisma.$queryRawUnsafe(`
      SELECT id, title, summary, tag, "createdAt", "sourceType"
      FROM instructions
      ${whereClause}
      ORDER BY "createdAt" DESC
      LIMIT 50
    `);

    return NextResponse.json({ success: true, data: results });

  } catch (error) {
    console.error('List Instructions Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
