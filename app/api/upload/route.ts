import { NextResponse } from 'next/server';
import { isAuthorizedRequest, TELEGRAM_AUTH_ERROR } from '@/lib/requestAuth';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const openai = new OpenAI({ apiKey: process.env.EMBEDDINGS_API_KEY || 'dummy_key' });

type UploadRequestBody = {
  text?: string;
  photoBase64?: string;
  source?: string;
  forceSave?: boolean;
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

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

export async function POST(req: Request) {
  try {
    if (!isAuthorizedRequest(req)) {
      return NextResponse.json({ error: TELEGRAM_AUTH_ERROR }, { status: 401 });
    }

    const body = await req.json() as UploadRequestBody;
    const { text, photoBase64, source, forceSave } = body;

    if (!text && !photoBase64) {
      return NextResponse.json({ error: 'Text or photo is required' }, { status: 400 });
    }

    let uploadedPhotoUrl = null;

    // If photo exists, upload to R2 and prepare Vision prompt
    if (photoBase64) {
      // photoBase64 might have prefix like data:image/jpeg;base64,...
      const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `${crypto.randomUUID()}.jpg`;

      try {
        await s3Client.send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET,
          Key: filename,
          Body: buffer,
          ContentType: 'image/jpeg'
        }));
        // Assuming public R2 URL format
        uploadedPhotoUrl = `https://${process.env.R2_PUBLIC_DOMAIN}/${filename}`;
      } catch (err) {
        console.error("R2 Upload Error:", err);
      }
    }

    let parsed: ParsedInstruction = { title: "Untitled", summary: "", tag: "general", fullText: text || "Image uploaded" };

    if (text) {
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
              content: `You are an AI that extracts and structures work instructions from text into a clean JSON format. 
Extract or generate the following fields:
- title: A short descriptive title
- summary: A 1-2 sentence summary
- tag: EXACTLY ONE of [vpn, tma, cs2, clario, general]
- fullText: The full formatted instruction in Markdown

Output ONLY a valid JSON object. Do not include markdown formatting like \`\`\`json around the output.`
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
    let hasEmbeddingsKey = process.env.EMBEDDINGS_API_KEY && process.env.EMBEDDINGS_API_KEY !== 'dummy_key';

    if (hasEmbeddingsKey) {
      try {
        const embeddingInput = `${summary}\n\n${fullText}`;
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: embeddingInput,
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
        return NextResponse.json({
          conflict: true,
          matches: results.filter(r => r.distance < 0.15),
          structuredData: parsed // So frontend can preserve it
        });
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

    return NextResponse.json({ success: true, data: newInstruction });

  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
