import { Bot, InlineKeyboard } from "grammy";
import dotenv from "dotenv";
import path from "path";
import crypto from "crypto";
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
  username: string | null;
  firstName: string | null;
};

async function getUser(telegramId: number): Promise<UserRow | null> {
  if (ADMIN_TELEGRAM_ID && String(telegramId) === ADMIN_TELEGRAM_ID) {
    return { telegramId: String(telegramId), role: 'admin', status: 'approved', username: null, firstName: null };
  }
  try {
    const rows = await prisma.$queryRaw<UserRow[]>`
      SELECT "telegramId", role, status, username, "firstName"
      FROM users WHERE "telegramId" = ${String(telegramId)} LIMIT 1
    `;
    return rows.length > 0 ? rows[0] : null;
  } catch (e) {
    console.error('DB check failed:', e);
    return null;
  }
}

async function notifyAdmin(telegramId: string, username: string | null, firstName: string | null) {
  if (!ADMIN_TELEGRAM_ID) return;
  const display = firstName || (username ? `@${username}` : telegramId);
  const text = `🔔 Новая заявка на доступ\n\nПользователь: ${display}\nID: ${telegramId}${username ? `\nUsername: @${username}` : ''}`;
  const keyboard = {
    inline_keyboard: [
      [
        { text: '✅ Одобрить', callback_data: `approve:${telegramId}` },
        { text: '❌ Отклонить', callback_data: `reject:${telegramId}` },
      ],
      [
        { text: '🚫 Заблокировать', callback_data: `ban:${telegramId}` },
      ],
    ],
  };
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_TELEGRAM_ID, text, reply_markup: keyboard }),
    });
  } catch (e) {
    console.error('Failed to notify admin:', e);
  }
}

bot.use(async (ctx, next) => {
  if (!ctx.from) return;
  const user = await getUser(ctx.from.id);

  if (user && user.status === 'approved') {
    return await next();
  }

  if (!user) {
    const id = crypto.randomUUID();
    const telegramId = String(ctx.from.id);
    const username = ctx.from.username || null;
    const firstName = ctx.from.first_name || null;
    try {
      await prisma.$executeRaw`
        INSERT INTO users (id, "telegramId", username, "firstName", role, status, "createdAt", "updatedAt")
        VALUES (${id}, ${telegramId}, ${username}, ${firstName}, 'viewer', 'pending', NOW(), NOW())
        ON CONFLICT ("telegramId") DO NOTHING
      `;
    } catch (e) {
      console.error('Failed to create pending user:', e);
    }
    await notifyAdmin(telegramId, username, firstName);
    await ctx.reply("У вас нет доступа. Заявка отправлена администратору. Ожидайте одобрения.");
    return;
  }

  if (user.status === 'pending') {
    await ctx.reply("Ваша заявка на рассмотрении. Ожидайте одобрения администратора.");
    return;
  }

  if (user.status === 'rejected') {
    await prisma.$executeRaw`
      UPDATE users SET status = 'pending', "updatedAt" = NOW()
      WHERE "telegramId" = ${String(ctx.from.id)}
    `;
    await notifyAdmin(String(ctx.from.id), ctx.from.username || null, ctx.from.first_name || null);
    await ctx.reply("Ваша заявка была отклонена. Заявка отправлена повторно. Ожидайте одобрения.");
    return;
  }

  if (user.status === 'banned') {
    return;
  }

  return await next();
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
    const keyboard = new InlineKeyboard().webApp("Открыть Mini App", TMA_URL);
    await bot.api.sendMessage(telegramId, "✅ Вам одобрен доступ! Теперь вы можете пользоваться ботом и Mini App.", { reply_markup: keyboard });
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
    await bot.api.sendMessage(telegramId, "❌ Ваша заявка на доступ отклонена администратором.");
  } catch (e) {
    console.error('Reject error:', e);
    await ctx.answerCallbackQuery({ text: "Ошибка" });
  }
});

bot.callbackQuery(/^ban:(.+)$/, async (ctx) => {
  const telegramId = ctx.match[1];
  try {
    await prisma.$executeRaw`UPDATE users SET status = 'banned', "updatedAt" = NOW() WHERE "telegramId" = ${telegramId}`;
    await ctx.editMessageText(`🚫 Пользователь ${telegramId} заблокирован.`);
    await ctx.answerCallbackQuery({ text: "Заблокирован" });
  } catch (e) {
    console.error('Ban error:', e);
    await ctx.answerCallbackQuery({ text: "Ошибка" });
  }
});

bot.start({
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} is running!`);
  },
});
