import { NextResponse } from 'next/server';
import { verifyTelegramInitData } from '@/lib/telegramAuth';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const openai = new OpenAI({ apiKey: process.env.EMBEDDINGS_API_KEY || 'dummy_key' });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key' });

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
    const initData = req.headers.get('x-telegram-init-data');
    const botTokenHeader = req.headers.get('x-bot-token');
    
    let isAuthorized = false;
    
    if (botTokenHeader === process.env.BOT_TOKEN) {
      isAuthorized = true;
    } else if (initData && verifyTelegramInitData(initData, process.env.BOT_TOKEN!)) {
      isAuthorized = true;
    } else if (process.env.NODE_ENV !== 'production') {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { text, photoBase64, source, forceSave } = body;
    
    if (!text && !photoBase64) {
      return NextResponse.json({ error: 'Text or photo is required' }, { status: 400 });
    }

    let uploadedPhotoUrl = null;
    let claudeInput: any = [];

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

      claudeInput.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: base64Data,
        }
      });
    }

    if (text) {
      claudeInput.push({
        type: "text",
        text: `Additional text from user:\n\n${text}`
      });
    } else {
      claudeInput.push({
        type: "text",
        text: "Please transcribe the provided image and structure the instruction."
      });
    }

    // Step 1: Structure text via Claude
    const msg = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1024,
      system: `You are an AI that extracts and structures work instructions from text or images into a clean JSON format. 
Extract or generate the following fields:
- title: A short descriptive title
- summary: A 1-2 sentence summary
- tag: EXACTLY ONE of [vpn, tma, cs2, clario, general]
- fullText: The full formatted instruction in Markdown

Output ONLY a valid JSON object. Do not include markdown formatting like \`\`\`json around the output.`,
      messages: [
        { role: "user", content: claudeInput }
      ],
    });

    // @ts-ignore
    const responseText = msg.content[0]?.text || "{}";
    
    // Parse JSON from Claude response
    let parsed;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch (e) {
      console.error("Failed to parse Claude JSON", responseText);
      return NextResponse.json({ error: 'Failed to structure text' }, { status: 500 });
    }

    const { title, summary, tag, fullText } = parsed;

    // Step 2: Generate Embeddings
    const embeddingInput = `${summary}\n\n${fullText}`;
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: embeddingInput,
    });
    const embedding = embeddingResponse.data[0].embedding;
    const embeddingStr = `[${embedding.join(',')}]`;

    // Step 3: Duplicate / Conflict check using pgvector
    if (!forceSave) {
      const similar = await prisma.$queryRaw`
        SELECT id, title, summary, tag, "createdAt", 
        (embedding <=> ${embeddingStr}::vector) as distance
        FROM instructions
        ORDER BY distance ASC
        LIMIT 3
      `;
      
      const results = similar as any[];
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
