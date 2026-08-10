import { prisma } from '@/lib/prisma';
import { isAuthorizedRequest, TELEGRAM_AUTH_ERROR } from '@/lib/requestAuth';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  sortOrder: number;
  instructionCount: number;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\wа-яё]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

export async function GET(req: Request) {
  try {
    if (!isAuthorizedRequest(req)) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR }, { status: 401 });
    }

    const rows = await prisma.$queryRaw<CategoryRow[]>`
      SELECT c.id, c.name, c.slug, c.icon, c.color, c."parentId", c."sortOrder",
        (SELECT COUNT(*) FROM instructions WHERE tag = c.slug)::int as "instructionCount"
      FROM categories c
      ORDER BY c."sortOrder" ASC, c.name ASC
    `;

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Categories GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    if (!isAuthorizedRequest(req)) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR }, { status: 401 });
    }

    const { name, icon, color, parentId } = (await req.json().catch(() => ({}))) as {
      name?: string;
      icon?: string;
      color?: string;
      parentId?: string;
    };

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();
    const slug = slugify(trimmedName);
    const id = crypto.randomUUID();

    const maxOrder = await prisma.$queryRaw<{ max: number }[]>`
      SELECT COALESCE(MAX("sortOrder"), 0) as max FROM categories
    `;
    const sortOrder = (maxOrder[0]?.max ?? 0) + 1;

    await prisma.$executeRaw`
      INSERT INTO categories (id, name, slug, icon, color, "parentId", "sortOrder", "createdAt", "updatedAt")
      VALUES (${id}, ${trimmedName}, ${slug}, ${icon || null}, ${color || null}, ${parentId || null}, ${sortOrder}, NOW(), NOW())
    `;

    return NextResponse.json({
      success: true,
      data: { id, name: trimmedName, slug, icon: icon || null, color: color || null, parentId: parentId || null, sortOrder },
    });
  } catch (error) {
    console.error('Categories POST error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
