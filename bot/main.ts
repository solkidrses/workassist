import { Bot, InlineKeyboard } from "grammy";
import dotenv from "dotenv";
import path from "path";

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is required");
}

const bot = new Bot(token);
const API_URL = process.env.API_URL || "http://localhost:3000";
const TMA_URL = process.env.NEXT_PUBLIC_TMA_URL || "https://example.com";
const ALLOWED_USER_ID = parseInt(process.env.ALLOWED_USER_ID || "0", 10);

// Simple auth middleware
bot.use(async (ctx, next) => {
  if (ctx.from?.id !== ALLOWED_USER_ID && ALLOWED_USER_ID !== 0) {
    console.log(`Blocked user ${ctx.from?.id}`);
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
        // Return information about conflict
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

// Start bot
bot.start({
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} is running!`);
  },
});
