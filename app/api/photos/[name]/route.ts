import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { verifyPhotoSignature } from '@/lib/photoSign';
import { authorizeRequest } from '@/lib/requestAuth';

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
  // 2. Or valid Telegram request authentication
  const url = new URL(req.url);
  const sig = url.searchParams.get('sig');
  const isSigned = verifyPhotoSignature(name, sig);

  if (!isSigned) {
    const auth = await authorizeRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ error: 'Access denied: valid signature or session required' }, { status: 403 });
    }
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
        'Cache-Control': 'public, max-age=3600',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
