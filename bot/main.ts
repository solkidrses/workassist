import { Bot, InlineKeyboard } from "grammy";
import dotenv from "dotenv";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is required");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const bot = new Bot(token);
const API_URL = process.env.API_URL || "http://localhost:3000";
const TMA_URL = process.env.NEXT_PUBLIC_TMA_URL || "https://example.com";
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || "";

type UserRow = {
  telegramId: string;
  role: string;
  status: string;
};

async function isUserApproved(telegramId: number): Promise<boolean> {
  if (ADMIN_TELEGRAM_ID && String(telegramId) === ADMIN_TELEGRAM_ID) return true;

  try {
    const rows = await prisma.$queryRaw<UserRow[]>`
      SELECT "telegramId", role, status FROM users WHERE "telegramId" = ${String(telegramId)} LIMIT 1
    `;
    return rows.length > 0 && rows[0].status === 'approved';
  } catch (e) {
    console.error('DB check failed, blocking user:', e);
    return false;
  }
}

bot.use(async (ctx, next) => {
  if (!ctx.from) return;
  const approved = await isUserApproved(ctx.from.id);
  if (!approved) {
    console.log(`Blocked user ${ctx.from.id}`);
    if (ctx.message) {
      await ctx.reply("У вас нет доступа. Откройте Mini App и запросите доступ у администратора.");
    }
    return;
  }
  await next();
});

bot.command("start", (ctx) => {
  ctx.reply("Привет! Я твой ИИ-ассистент по рабочим инструкциям. Отправь мне текст или фото (скоро), и я сохраню их в базу.");
});

bot.command("app", (ctx) => {
  const keyboard = new InlineKeyboard().webApp("Открыть базу", TMA_URL);
  ctx.reply("Нажми кнопку ниже, чтобы открыть Mini App:", { reply_markup: keyboard });
});

type UploadConflictMatch = {
  title: string;
};

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  
  const waitMsg = await ctx.reply("⏳ Сохраняю и генерирую структуру...");
  
  try {
    const res = await fetch(`${API_URL}/api/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bot-token": process.env.BOT_TOKEN || "",
      },
      body: JSON.stringify({
        text,
        source: "bot_text",
        forceSave: false,
      }),
    });

    const data = await res.json();
    
    if (!res.ok) {
      if (data.conflict) {
        const matches = data.matches as UploadConflictMatch[];
        await ctx.api.editMessageText(
          ctx.chat.id,
          waitMsg.message_id,
          `⚠️ Найдены похожие инструкции:\n\n${matches.map((match) => `- ${match.title}`).join('\n')}\n\nОткрой Mini App для ручного сохранения.`
        );
        return;
      }
      throw new Error(data.error || "Unknown error");
    }

    await ctx.api.editMessageText(
      ctx.chat.id,
      waitMsg.message_id,
      `✅ Сохранено!\nНазвание: ${data.data[0].title}\nТег: ${data.data[0].tag}`
    );
  } catch (error) {
    console.error(error);
    await ctx.api.editMessageText(
      ctx.chat.id,
      waitMsg.message_id,
      "❌ Ошибка при сохранении. Проверь логи сервера."
    );
  }
});

bot.callbackQuery(/^approve:(.+)$/, async (ctx) => {
  const telegramId = ctx.match[1];
  try {
    await prisma.$executeRaw`UPDATE users SET status = 'approved', "updatedAt" = NOW() WHERE "telegramId" = ${telegramId}`;
    await ctx.editMessageText(`✅ Пользователь ${telegramId} одобрен.`);
    await ctx.answerCallbackQuery({ text: "Одобрено" });
  } catch (e) {
    console.error('Approve error:', e);
    await ctx.answerCallbackQuery({ text: "Ошибка" });
  }
});

bot.callbackQuery(/^reject:(.+)$/, async (ctx) => {
  const telegramId = ctx.match[1];
  try {
    await prisma.$executeRaw`UPDATE users SET status = 'rejected', "updatedAt" = NOW() WHERE "telegramId" = ${telegramId}`;
    await ctx.editMessageText(`❌ Пользователь ${telegramId} отклонён.`);
    await ctx.answerCallbackQuery({ text: "Отклонено" });
  } catch (e) {
    console.error('Reject error:', e);
    await ctx.answerCallbackQuery({ text: "Ошибка" });
  }
});

bot.start({
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} is running!`);
  },
});
