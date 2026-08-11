import { verifyTelegramInitData } from '@/lib/telegramAuth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const TELEGRAM_AUTH_ERROR = 'Не удалось подтвердить Telegram-сессию. Откройте Mini App через кнопку в боте и попробуйте снова.';

type AuthResult = {
  ok: boolean;
  code?: 'INVALID' | 'PENDING' | 'REJECTED' | 'NO_ACCESS';
  user?: {
    telegramId: string;
    role: string;
    status: string;
    username: string | null;
    firstName: string | null;
  };
};

type UserRow = {
  telegramId: string;
  role: string;
  username: string | null;
  firstName: string | null;
  status: string;
};

function parseTelegramUser(initDataString: string): { id: string; username: string | null; first_name: string | null } | null {
  try {
    const params = new URLSearchParams(initDataString);
    const userJson = params.get('user');
    if (!userJson) return null;
    const user = JSON.parse(userJson);
    if (!user.id) return null;
    return {
      id: String(user.id),
      username: user.username || null,
      first_name: user.first_name || null,
    };
  } catch {
    return null;
  }
}

export async function authorizeRequest(req: Request): Promise<AuthResult> {
  if (process.env.NODE_ENV !== 'production') {
    return {
      ok: true,
      user: { telegramId: 'dev', role: 'admin', status: 'approved', username: 'dev', firstName: 'Dev' },
    };
  }

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    return { ok: false, code: 'INVALID' };
  }

  const botTokenHeader = req.headers.get('x-bot-token');
  if (botTokenHeader && botTokenHeader === botToken) {
    return {
      ok: true,
      user: { telegramId: 'bot', role: 'admin', status: 'approved', username: 'bot', firstName: 'Bot' },
    };
  }

  const initData = req.headers.get('x-telegram-init-data');
  if (!initData) {
    return { ok: false, code: 'INVALID' };
  }

  if (!verifyTelegramInitData(initData, botToken)) {
    return { ok: false, code: 'INVALID' };
  }

  const telegramUser = parseTelegramUser(initData);
  if (!telegramUser) {
    return { ok: false, code: 'INVALID' };
  }

  const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
  if (adminTelegramId && telegramUser.id === adminTelegramId) {
    return {
      ok: true,
      user: {
        telegramId: telegramUser.id,
        role: 'admin',
        status: 'approved',
        username: telegramUser.username,
        firstName: telegramUser.first_name,
      },
    };
  }

  try {
    const rows = await prisma.$queryRaw<UserRow[]>`
      SELECT "telegramId", role, username, "firstName", status
      FROM users
      WHERE "telegramId" = ${telegramUser.id}
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return { ok: false, code: 'NO_ACCESS' };
    }

    const user = rows[0];

    if (user.status === 'pending') {
      return { ok: false, code: 'PENDING' };
    }

    if (user.status === 'rejected') {
      return { ok: false, code: 'REJECTED' };
    }

    if (user.status === 'approved') {
      return {
        ok: true,
        user: {
          telegramId: user.telegramId,
          role: user.role,
          status: user.status,
          username: user.username,
          firstName: user.firstName,
        },
      };
    }

    return { ok: false, code: 'NO_ACCESS' };
  } catch {
    return { ok: false, code: 'INVALID' };
  }
}

export async function requireAdmin(req: Request): Promise<{ ok: true; user: AuthResult['user'] } | NextResponse> {
  const auth = await authorizeRequest(req);
  if (!auth.ok || !auth.user || auth.user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required', code: auth.code || 'NO_ACCESS' }, { status: 403 });
  }
  return { ok: true, user: auth.user };
}
