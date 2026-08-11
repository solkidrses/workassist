import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/requestAuth';

type UserListRow = {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  role: string;
  status: string;
  createdAt: string;
};

export async function GET(req: Request) {
  const adminCheck = await requireAdmin(req);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const rows = await prisma.$queryRaw<UserListRow[]>`
      SELECT id, "telegramId", username, "firstName", role, status, "createdAt"
      FROM users
      ORDER BY
        CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
        "createdAt" DESC
    `;

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Users GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const adminCheck = await requireAdmin(req);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const { telegramId, action, role } = (await req.json().catch(() => ({}))) as {
      telegramId?: string;
      action?: 'approve' | 'reject' | 'setRole' | 'delete';
      role?: string;
    };

    if (!telegramId || !action) {
      return NextResponse.json({ error: 'telegramId and action are required' }, { status: 400 });
    }

    const adminTelegramId = process.env.ADMIN_TELEGRAM_ID;
    if (telegramId === adminTelegramId) {
      return NextResponse.json({ error: 'Cannot modify admin' }, { status: 403 });
    }

    if (action === 'approve') {
      await prisma.$executeRaw`
        UPDATE users SET status = 'approved', "updatedAt" = NOW()
        WHERE "telegramId" = ${telegramId}
      `;
    } else if (action === 'reject') {
      await prisma.$executeRaw`
        UPDATE users SET status = 'rejected', "updatedAt" = NOW()
        WHERE "telegramId" = ${telegramId}
      `;
    } else if (action === 'setRole') {
      if (role !== 'admin' && role !== 'viewer') {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      await prisma.$executeRaw`
        UPDATE users SET role = ${role}, "updatedAt" = NOW()
        WHERE "telegramId" = ${telegramId}
      `;
    } else if (action === 'delete') {
      await prisma.$executeRaw`
        DELETE FROM users WHERE "telegramId" = ${telegramId}
      `;
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Users PUT error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
