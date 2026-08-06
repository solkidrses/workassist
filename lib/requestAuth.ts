import { verifyTelegramInitData } from '@/lib/telegramAuth';

export const TELEGRAM_AUTH_ERROR = 'Не удалось подтвердить Telegram-сессию. Откройте Mini App через кнопку в боте и попробуйте снова.';

export function isAuthorizedRequest(req: Request): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    return false;
  }

  const botTokenHeader = req.headers.get('x-bot-token');
  if (botTokenHeader && botTokenHeader === botToken) {
    return true;
  }

  const initData = req.headers.get('x-telegram-init-data');
  if (!initData) {
    return false;
  }

  return verifyTelegramInitData(initData, botToken);
}
