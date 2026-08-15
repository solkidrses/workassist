import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requestAuth';
import { cleanupText } from '@/lib/textCleanup';
import mammoth from 'mammoth';
import TurndownService from 'turndown';
import crypto from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
};

export async function POST(req: Request) {
  try {
    const adminCheck = await requireAdmin(req);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Файл не загружен' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Файл слишком большой (макс. 50 МБ)' }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let text = '';
    let imageCount = 0;

    if (filename.endsWith('.txt')) {
      text = buffer.toString('utf-8');
    } else if (filename.endsWith('.docx')) {
      const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
      await mkdir(uploadsDir, { recursive: true });

      const result = await mammoth.convertToHtml(
        { buffer },
        {
          convertImage: mammoth.images.imgElement(async (image) => {
            try {
              const imgBuffer = await image.read();
              const ext = EXT_BY_MIME[image.contentType] || 'png';
              const name = `${crypto.randomUUID()}.${ext}`;
              await writeFile(path.join(uploadsDir, name), imgBuffer);
              imageCount++;
              return { src: `/api/photos/${name}` };
            } catch (err) {
              console.error('Failed to save docx image:', err);
              return { src: '' };
            }
          }),
        }
      );

      const htmlCleaned = result.value.replace(/<a[^>]*href="#[^"]*"[^>]*>(.*?)<\/a>/gi, '$1');
      text = turndown.turndown(htmlCleaned);
      text = text.replace(/!\[[^\]]*\]\(\)/g, '');
    } else {
      return NextResponse.json({ error: 'Поддерживаются только .txt и .docx' }, { status: 400 });
    }

    const cleaned = cleanupText(text);
    const titleFromFilename = file.name.replace(/\.(docx|txt)$/i, '').replace(/[_-]+/g, ' ').trim();

    return NextResponse.json({
      success: true,
      text: cleaned,
      filename: file.name,
      suggestedTitle: titleFromFilename,
      imageCount,
    });
  } catch (error) {
    console.error('Extract error:', error);
    return NextResponse.json({ error: 'Не удалось извлечь текст из файла' }, { status: 500 });
  }
}
