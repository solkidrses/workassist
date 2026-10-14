import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeRequest, requireAdmin, TELEGRAM_AUTH_ERROR } from '@/lib/requestAuth';
import { signPhotoPath, signMarkdownPhotos } from '@/lib/photoSign';
import OpenAI from 'openai';
import { unlink } from 'fs/promises';
import path from 'path';

type InstructionRow = {
  id: string;
  title: string;
  summary: string;
  fullText: string;
  tag: string;
  sourceType: string;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type InstructionUpdateRow = {
  id: string;
  title: string;
  summary: string;
  fullText: string;
  tag: string;
  updatedAt: string;
};

const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY;
const siliconflow = new OpenAI({ apiKey: SILICONFLOW_API_KEY || 'dummy_key', baseURL: 'https://api.siliconflow.com/v1' });

// Demo instruction for local testing when database is offline
const DEV_DEMO_INSTRUCTION: InstructionRow = {
  id: 'demo',
  title: 'Инструкция по настройке сервиса и безопасности',
  summary: 'Пошаговое руководство по авторизации, ключам и параметрам доступа',
  fullText: `# Руководство по настройке сервиса

Добро пожаловать в рабочую инструкцию. Здесь описаны основные этапы работы с системой.

### Вводная часть
Перед началом убедитесь, что у вас есть доступ к корпоративной сети и стабильное интернет-соединение.
В случае технических неполадок обратитесь в дежурный чат техподдержки.

### Шаг 1: Авторизация и пароль
1. Откройте панель входа в систему по выданной вам ссылке.
2. В первом поле укажите ваш рабочий адрес электронной почты.
3. Введите временный пароль, полученный в приветственном письме от администратора.
4. При первом входе обязательно измените временный пароль на новый сложный пароль.

### Шаг 2: Настройка безопасного профиля
Перейдите в раздел «Безопасность» в правом верхнем углу интерфейса.
Включите двухфакторную аутентификацию для защиты аккаунта.
Сохраните резервные коды доступа в надежном месте (например, в менеджере паролей).

### Шаг 3: Синхронизация данных
Нажмите кнопку «Синхронизировать» на главной странице приложения.
Дождитесь завершения процесса и появления сообщения об успешном обновлении базы.

### Важные правила безопасности
- Никогда не сообщайте свой личный пароль коллегам или посторонним лицам.
- Если вы забыли пароль, воспользуйтесь функцией «Сбросить пароль» на экране входа.
- Регулярно обновляйте клиентское приложение до последней актуальной версии.`,
  tag: 'general',
  sourceType: 'bot_text',
  photoUrl: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// GET /api/instructions/[id]
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (id === 'demo' && process.env.NODE_ENV !== 'production') {
    return NextResponse.json({ success: true, data: DEV_DEMO_INSTRUCTION });
  }

  try {
    const auth = await authorizeRequest(req);
    if (!auth.ok) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR, code: auth.code }, { status: 403 });
    }

    const results = await prisma.$queryRaw<InstructionRow[]>`
      SELECT id, title, summary, "fullText", tag, "sourceType", "photoUrl", "createdAt", "updatedAt"
      FROM instructions
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!results || results.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({ success: true, data: { ...DEV_DEMO_INSTRUCTION, id } });
      }
      return NextResponse.json({ error: 'Instruction not found' }, { status: 404 });
    }

    const item = results[0];
    if (item.photoUrl) {
      item.photoUrl = signPhotoPath(item.photoUrl);
    }
    if (item.fullText) {
      item.fullText = signMarkdownPhotos(item.fullText);
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error('Fetch Instruction Error:', error);
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ success: true, data: { ...DEV_DEMO_INSTRUCTION, id } });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/instructions/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminCheck = await requireAdmin(req);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const { id } = await params;
    const body = await req.json();
    const { title, summary, fullText, tag } = body;

    const MAX_TITLE = 200;
    const MAX_SUMMARY = 1000;
    const MAX_FULLTEXT = 100_000;
    const MAX_TAG = 50;

    if (title && title.length > MAX_TITLE) {
      return NextResponse.json({ error: `Title too long (max ${MAX_TITLE} chars)` }, { status: 400 });
    }
    if (summary && summary.length > MAX_SUMMARY) {
      return NextResponse.json({ error: `Summary too long (max ${MAX_SUMMARY} chars)` }, { status: 400 });
    }
    if (fullText && fullText.length > MAX_FULLTEXT) {
      return NextResponse.json({ error: `Text too long (max ${MAX_FULLTEXT} chars)` }, { status: 400 });
    }
    if (tag && tag.length > MAX_TAG) {
      return NextResponse.json({ error: `Tag too long (max ${MAX_TAG} chars)` }, { status: 400 });
    }

    // Regenerate embedding if text fields changed and API key is available.
    // Must use the same embedding model as the rest of the app, otherwise the
    // vector space mixes and semantic search returns garbage for this row.
    const hasEmbeddingsKey = Boolean(SILICONFLOW_API_KEY && SILICONFLOW_API_KEY !== 'dummy_key');
    let embeddingStr: string | null = null;

    if (hasEmbeddingsKey && (title || summary || fullText)) {
      try {
        const embeddingInput = `${summary || ''}\n\n${fullText || ''}`;
        const embeddingResponse = await siliconflow.embeddings.create({
          model: 'Qwen/Qwen3-Embedding-4B',
          input: embeddingInput,
          dimensions: 1536,
        });
        const embedding = embeddingResponse.data[0].embedding;
        embeddingStr = `[${embedding.join(',')}]`;
      } catch (e) {
        console.error('Embedding update error:', e);
      }
    }

    if (embeddingStr) {
      await prisma.$executeRawUnsafe(
        `UPDATE instructions SET title = $1, summary = $2, "fullText" = $3, tag = $4, embedding = $5::vector, "updatedAt" = NOW() WHERE id = $6`,
        title || 'Untitled', summary || '', fullText || '', tag || 'general', embeddingStr, id
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE instructions SET title = $1, summary = $2, "fullText" = $3, tag = $4, "updatedAt" = NOW() WHERE id = $5`,
        title || 'Untitled', summary || '', fullText || '', tag || 'general', id
      );
    }

    const updated = await prisma.$queryRaw<InstructionUpdateRow[]>`
      SELECT id, title, summary, "fullText", tag, "updatedAt"
      FROM instructions WHERE id = ${id}
    `;

    return NextResponse.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error('Update Instruction Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/instructions/[id]
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminCheck = await requireAdmin(req);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const { id } = await params;

    // Get photoUrl before deleting so we can clean up the file
    const rows = await prisma.$queryRaw<{ photoUrl: string | null }[]>`
      SELECT "photoUrl" FROM instructions WHERE id = ${id}
    `;
    const photoUrl = rows[0]?.photoUrl;

    await prisma.$queryRaw`
      DELETE FROM instructions
      WHERE id = ${id}
    `;

    // Delete photo file from disk if it exists
    if (photoUrl) {
      const filename = photoUrl.split('/').pop();
      if (filename) {
        const filePath = path.join(process.cwd(), 'data', 'uploads', filename);
        try {
          await unlink(filePath);
        } catch {
          // File may not exist, ignore
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Instruction Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
