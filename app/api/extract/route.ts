import { NextResponse } from 'next/server';
import { isAuthorizedRequest, TELEGRAM_AUTH_ERROR } from '@/lib/requestAuth';
import { cleanupText } from '@/lib/textCleanup';
import mammoth from 'mammoth';
import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    if (!isAuthorizedRequest(req)) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Файл не загружен' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Файл слишком большой (макс. 5 МБ)' }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let text = '';
    let html = '';

    if (filename.endsWith('.txt')) {
      text = buffer.toString('utf-8');
    } else if (filename.endsWith('.docx')) {
      const result = await mammoth.convertToHtml({ buffer });
      html = result.value;
      text = turndown.turndown(html);
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
    });
  } catch (error) {
    console.error('Extract error:', error);
    return NextResponse.json({ error: 'Не удалось извлечь текст из файла' }, { status: 500 });
  }
}
