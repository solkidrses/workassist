import { prisma } from '@/lib/prisma';
import { authorizeRequest, requireAdmin, TELEGRAM_AUTH_ERROR } from '@/lib/requestAuth';
import { NextResponse } from 'next/server';

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  sortOrder: number;
};

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await requireAdmin(req);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const { id } = await params;
    const { name, icon, color, parentId, sortOrder } = (await req.json().catch(() => ({}))) as {
      name?: string;
      icon?: string;
      color?: string;
      parentId?: string;
      sortOrder?: number;
    };

    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIdx = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIdx++}`);
      values.push(name.trim());
    }
    if (icon !== undefined) {
      updates.push(`icon = $${paramIdx++}`);
      values.push(icon || null);
    }
    if (color !== undefined) {
      updates.push(`color = $${paramIdx++}`);
      values.push(color || null);
    }
    if (parentId !== undefined) {
      updates.push(`"parentId" = $${paramIdx++}`);
      values.push(parentId || null);
    }
    if (sortOrder !== undefined) {
      updates.push(`"sortOrder" = $${paramIdx++}`);
      values.push(sortOrder);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push(`"updatedAt" = NOW()`);
    values.push(id);
    const idParam = `$${paramIdx++}`;

    await prisma.$executeRawUnsafe(
      `UPDATE categories SET ${updates.join(', ')} WHERE id = ${idParam}`,
      ...values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Category PUT error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await requireAdmin(req);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const reassignTo = searchParams.get('reassignTo');

    if (reassignTo) {
      const newSlug = await prisma.$queryRaw<{ slug: string }[]>`
        SELECT slug FROM categories WHERE id = ${reassignTo}
      `;
      if (newSlug.length > 0) {
        const oldCat = await prisma.$queryRaw<{ slug: string }[]>`
          SELECT slug FROM categories WHERE id = ${id}
        `;
        if (oldCat.length > 0) {
          await prisma.$executeRaw`
            UPDATE instructions SET tag = ${newSlug[0].slug} WHERE tag = ${oldCat[0].slug}
          `;
        }
      }
    }

    await prisma.$executeRaw`DELETE FROM categories WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Category DELETE error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
