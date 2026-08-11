import crypto from 'crypto';

const COOKIE_NAME = 'wa_session';
const MAX_AGE_SECONDS = 86400; // 24h

function getKey(): string {
  return process.env.BOT_TOKEN || 'fallback-dev-key';
}

export function signSession(telegramId: string): string {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = `${telegramId}:${expires}`;
  const sig = crypto.createHmac('sha256', getKey()).update(payload).digest('hex');
  return `${payload}:${sig}`;
}

export function verifySession(cookieHeader: string | null): { ok: boolean; telegramId?: string } {
  if (!cookieHeader) return { ok: false };

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const raw = cookies.find(c => c.startsWith(`${COOKIE_NAME}=`));
  if (!raw) return { ok: false };

  const value = raw.slice(COOKIE_NAME.length + 1);
  const parts = value.split(':');
  if (parts.length !== 3) return { ok: false };

  const [telegramId, expiresStr, sig] = parts;
  const expires = parseInt(expiresStr, 10);

  if (isNaN(expires) || expires < Math.floor(Date.now() / 1000)) {
    return { ok: false };
  }

  const expectedSig = crypto.createHmac('sha256', getKey()).update(`${telegramId}:${expires}`).digest('hex');

  if (sig !== expectedSig) return { ok: false };

  return { ok: true, telegramId };
}

export function sessionCookieHeader(telegramId: string): string {
  const value = signSession(telegramId);
  return `${COOKIE_NAME}=${value}; HttpOnly; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

export { COOKIE_NAME };
