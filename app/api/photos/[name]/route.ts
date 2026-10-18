import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { verifyPhotoSignature } from '@/lib/photoSign';
import { authorizeRequest } from '@/lib/requestAuth';
import { verifySession } from '@/lib/sessionCookie';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  if (!/^[\w\-.]+$/.test(name)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  // Check access:
  // 1. Valid signed URL parameter: ?sig=...
  // 2. Or valid session cookie (wa_session)
  // 3. Or valid Telegram request authentication (initData query/header)
  const url = new URL(req.url);
  const sig = url.searchParams.get('sig');
  const isSigned = verifyPhotoSignature(name, sig);

  if (!isSigned) {
    let authorized = false;

    // 1. Check session cookie
    const cookieHeader = req.headers.get('cookie');
    const session = verifySession(cookieHeader);
    if (session.ok) {
      if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_BYPASS === '1') {
        authorized = true;
      } else if (session.telegramId) {
        if (process.env.ADMIN_TELEGRAM_ID && session.telegramId === process.env.ADMIN_TELEGRAM_ID) {
          authorized = true;
        } else {
          try {
            const rows = await prisma.$queryRaw<{ status: string }[]>`
              SELECT status FROM users WHERE "telegramId" = ${session.telegramId} LIMIT 1
            `;
            if (rows.length > 0 && rows[0].status === 'approved') {
              authorized = true;
            }
          } catch (e) {
            console.error('Photo session check error:', e);
          }
        }
      }
    }

    // 2. Fallback to authorizeRequest (covers initData from query/header, dev bypass, internal API key)
    if (!authorized) {
      const auth = await authorizeRequest(req);
      if (auth.ok) {
        authorized = true;
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: 'Access denied: valid signature or session required' }, { status: 403 });
    }
  }

  let filePath = path.join(process.cwd(), 'data', 'uploads', name);
  let buffer: Buffer;

  try {
    buffer = await readFile(filePath);
  } catch {
    // Fallback: check legacy public/uploads location
    try {
      filePath = path.join(process.cwd(), 'public', 'uploads', name);
      buffer = await readFile(filePath);
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
  }

  const ext = path.extname(name).toLowerCase();
  const contentType =
    ext === '.png' ? 'image/png' :
    ext === '.webp' ? 'image/webp' :
    ext === '.gif' ? 'image/gif' :
    'image/jpeg';

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
