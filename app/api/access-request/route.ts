import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyTelegramInitData } from '@/lib/telegramAuth';
import { rateLimit } from '@/lib/rateLimit';
import crypto from 'crypto';

type UserRow = {
  id: string;
  telegramId: string;
  status: string;
  username: string | null;
  firstName: string | null;
};

async function notifyAdmin(botToken: string, adminChatId: string, telegramId: string, username: string | null, firstName: string | null) {
  const display = firstName || (username ? `@${username}` : telegramId);
  const text = `🔔 Новая заявка на доступ\n\nПользователь: ${display}\nID: ${telegramId}${username ? `\nUsername: @${username}` : ''}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Одобрить', callback_data: `approve:${telegramId}` },
        { text: '❌ Отклонить', callback_data: `reject:${telegramId}` },
      ],
    ],
  };

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: adminChatId, text, reply_markup: keyboard }),
    });
  } catch (e) {
    console.error('Failed to notify admin:', e);
  }
}

export async function POST(req: Request) {
  try {
    const initData = req.headers.get('x-telegram-init-data');
    if (!initData) {
      return NextResponse.json({ error: 'Telegram initData required' }, { status: 401 });
    }

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    if (process.env.NODE_ENV === 'production' && !verifyTelegramInitData(initData, botToken)) {
      return NextResponse.json({ error: 'Invalid Telegram signature' }, { status: 401 });
    }

    const params = new URLSearchParams(initData);
    const userJson = params.get('user');
    if (!userJson) {
      return NextResponse.json({ error: 'User data missing' }, { status: 400 });
    }

    const telegramUser = JSON.parse(userJson);
    const telegramId = String(telegramUser.id);
    const username = telegramUser.username || null;
    const firstName = telegramUser.first_name || null;

    const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
    if (adminTelegramId && telegramId === adminTelegramId) {
      return NextResponse.json({ success: true, data: { status: 'admin', message: 'You are the admin' } });
    }

    const rl = rateLimit(`access-request:${telegramId}`, 3, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: 'Слишком много заявок. Попробуйте позже.' }, { status: 429 });
    }

    const existing = await prisma.$queryRaw<UserRow[]>`
      SELECT id, "telegramId", status, username, "firstName"
      FROM users
      WHERE "telegramId" = ${telegramId}
      LIMIT 1
    `;

    if (existing && existing.length > 0) {
      const user = existing[0];
      if (user.status === 'approved') {
        return NextResponse.json({ success: true, data: { status: 'approved', message: 'Access already granted' } });
      }
      if (user.status === 'pending') {
        return NextResponse.json({ success: true, data: { status: 'pending', message: 'Request already submitted' } });
      }
      if (user.status === 'rejected') {
        await prisma.$executeRaw`
          UPDATE users SET status = 'pending', "updatedAt" = NOW()
          WHERE "telegramId" = ${telegramId}
        `;
        if (adminTelegramId) {
          await notifyAdmin(botToken, adminTelegramId, telegramId, username, firstName);
        }
        return NextResponse.json({ success: true, data: { status: 'pending', message: 'Request resubmitted' } });
      }
      if (user.status === 'banned') {
        return NextResponse.json({ error: 'Access denied', code: 'BANNED' }, { status: 403 });
      }
    }

    const id = crypto.randomUUID();
    await prisma.$executeRaw`
      INSERT INTO users (id, "telegramId", username, "firstName", role, status, "createdAt", "updatedAt")
      VALUES (${id}, ${telegramId}, ${username}, ${firstName}, 'viewer', 'pending', NOW(), NOW())
      ON CONFLICT ("telegramId") DO UPDATE SET status = 'pending', "updatedAt" = NOW()
    `;

    if (adminTelegramId) {
      await notifyAdmin(botToken, adminTelegramId, telegramId, username, firstName);
    }

    return NextResponse.json({ success: true, data: { status: 'pending', message: 'Access request submitted' } });
  } catch (error) {
    console.error('Access request error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
