import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requestAuth';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import crypto from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY;
const SILICONFLOW_BASE_URL = 'https://api.siliconflow.com/v1';
const siliconflow = new OpenAI({ apiKey: SILICONFLOW_API_KEY || 'dummy_key', baseURL: SILICONFLOW_BASE_URL });

type UploadRequestBody = {
  text?: string;
  photoBase64?: string;
  source?: string;
  forceSave?: boolean;
  skipAI?: boolean;
  title?: string;
  tag?: string;
};

type ParsedInstruction = {
  title: string;
  summary: string;
  tag: string;
  fullText: string;
};

type SimilarInstructionRow = {
  id: string;
  title: string;
  summary: string;
  tag: string;
  createdAt: string;
  distance: number;
};


export async function POST(req: Request) {
  try {
    const adminCheck = await requireAdmin(req);
    if (adminCheck instanceof NextResponse) return adminCheck;

    const body = await req.json() as UploadRequestBody;
    const { text, photoBase64, source, forceSave, skipAI, title: explicitTitle, tag: explicitTag } = body;

    if (!text && !photoBase64) {
      return NextResponse.json({ error: 'Text or photo is required' }, { status: 400 });
    }

    let uploadedPhotoUrl = null;
    let photoError = null;

    // If photo exists, save locally to public/uploads/
    if (photoBase64) {
      const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');
      
      if (buffer.length > MAX_PHOTO_SIZE) {
        return NextResponse.json({ error: 'Фото слишком большое (макс. 10 МБ)' }, { status: 400 });
      }
      
      const filename = `${crypto.randomUUID()}.jpg`;
      const uploadsDir = path.join(process.cwd(), 'data', 'uploads');

      try {
        await mkdir(uploadsDir, { recursive: true });
        await writeFile(path.join(uploadsDir, filename), buffer);
        uploadedPhotoUrl = `/api/photos/${filename}`;
      } catch (err) {
        console.error("Photo save error:", err);
        photoError = 'Не удалось сохранить фото. Инструкция сохранена без фото.';
      }
    }

    let parsed: ParsedInstruction = { title: "Untitled", summary: "", tag: "general", fullText: text || "Image uploaded" };

    if (skipAI && text) {
      const { cleanupText, deriveTitle, deriveSummary } = await import('@/lib/textCleanup');
      const cleaned = cleanupText(text);
      parsed = {
        title: explicitTitle?.trim() || deriveTitle(cleaned, 'Untitled'),
        summary: deriveSummary(cleaned),
        tag: explicitTag || 'general',
        fullText: cleaned,
      };
    } else if (text) {
      // Fetch available categories from DB
      const categoryRows = await prisma.$queryRaw<{ slug: string }[]>`
        SELECT slug FROM categories ORDER BY "sortOrder" ASC
      `;
      const availableTags = categoryRows.length > 0
        ? categoryRows.map(r => r.slug).join(', ')
        : 'vpn, tma, cs2, clario, general';

      // Use DeepSeek for structuring text
      const deepseek = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY || 'dummy',
        baseURL: 'https://api.deepseek.com/v1',
      });

      try {
        const msg = await deepseek.chat.completions.create({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: `Ты — ИИ, который извлекает и структурирует рабочие инструкции из текста в чистый JSON формат.
ОБЯЗАТЕЛЬНО пиши ВСЕ поля на русском языке.
Извлеки или сгенерируй следующие поля:
- title: Короткое описательное название на русском
- summary: Краткое описание в 1-2 предложения на русском
- tag: РОВНО ОДНО из [${availableTags}]
- fullText: Полный форматированный текст инструкции на русском в Markdown

Выведи ТОЛЬКО валидный JSON объект. Не включай markdown форматирование вроде \`\`\`json вокруг вывода.`
            },
            { role: "user", content: text }
          ],
          response_format: { type: "json_object" }
        });

        const responseText = msg.choices[0]?.message?.content || "{}";
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      } catch (e) {
        console.error("Failed to parse DeepSeek JSON", e);
        // Fallback to raw text if DeepSeek fails
        parsed.fullText = text;
      }
    }

    const { title, summary, tag, fullText } = parsed;

    // Step 2: Generate Embeddings (Fallback to zero-vector if dummy)
    let embeddingStr = '';
    let hasEmbeddingsKey = SILICONFLOW_API_KEY && SILICONFLOW_API_KEY !== 'dummy_key';

    if (hasEmbeddingsKey) {
      try {
        const embeddingInput = `${summary}\n\n${fullText}`;
        const embeddingResponse = await siliconflow.embeddings.create({
          model: 'Qwen/Qwen3-Embedding-4B',
          input: embeddingInput,
          dimensions: 1536,
        });
        const embedding = embeddingResponse.data[0].embedding;
        embeddingStr = `[${embedding.join(',')}]`;
      } catch (e) {
        console.error("Embedding error:", e);
        hasEmbeddingsKey = false;
      }
    }

    if (!hasEmbeddingsKey) {
      embeddingStr = '[' + new Array(1536).fill(0).join(',') + ']';
    }

    // Step 3: Duplicate / Conflict check using pgvector
    if (!forceSave && hasEmbeddingsKey) {
      const similar = await prisma.$queryRaw<SimilarInstructionRow[]>`
        SELECT id, title, summary, tag, "createdAt", 
        (embedding <=> ${embeddingStr}::vector) as distance
        FROM instructions
        ORDER BY distance ASC
        LIMIT 3
      `;

      const results = similar;
      if (results.length > 0 && results[0].distance < 0.15) {
        const conflictResponse: Record<string, unknown> = {
          conflict: true,
          matches: results.filter(r => r.distance < 0.15),
          structuredData: parsed
        };
        if (photoError) {
          conflictResponse.photoError = photoError;
        }
        return NextResponse.json(conflictResponse);
      }
    }

    // Step 4: Save to Database
    const id = crypto.randomUUID();
    const newInstruction = await prisma.$queryRaw`
      INSERT INTO instructions (id, title, summary, "fullText", tag, "sourceType", "photoUrl", embedding, "updatedAt")
      VALUES (
        ${id}, 
        ${title || 'Untitled'}, 
        ${summary || ''}, 
        ${fullText || text || ''}, 
        ${tag || 'general'}, 
        ${source || 'tma_text'}, 
        ${uploadedPhotoUrl},
        ${embeddingStr}::vector, 
        NOW()
      )
      RETURNING id, title, tag, summary
    `;

    const response: Record<string, unknown> = { success: true, data: newInstruction };
    if (photoError) {
      response.photoError = photoError;
    }
    return NextResponse.json(response);

  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
