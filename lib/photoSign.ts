import crypto from 'crypto';

function getPhotoSecret(): string {
  const secret = process.env.BOT_TOKEN || process.env.INTERNAL_API_KEY
    || (process.env.NODE_ENV !== 'production' ? 'workassist-photo-secret-salt-2026' : '');
  if (!secret) {
    // В production без секрета подписи становятся подделываемыми — падаем явно
    throw new Error('BOT_TOKEN or INTERNAL_API_KEY is required for photo signatures');
  }
  return secret;
}

export function createPhotoSignature(filename: string): string {
  const secret = getPhotoSecret();
  return crypto
    .createHmac('sha256', secret)
    .update(`photo:${filename}`)
    .digest('hex')
    .substring(0, 32);
}

export function verifyPhotoSignature(filename: string, sig: string | null): boolean {
  if (!sig || typeof sig !== 'string') return false;
  const expected = createPhotoSignature(filename);
  if (sig.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function signPhotoPath(photoPath: string | null | undefined): string | null {
  if (!photoPath || typeof photoPath !== 'string') return null;
  if (!photoPath.startsWith('/api/photos/')) return photoPath;
  const [base] = photoPath.split('?');
  const filename = base.replace('/api/photos/', '');
  if (!filename) return photoPath;
  const sig = createPhotoSignature(filename);
  return `${base}?sig=${sig}`;
}

export function signMarkdownPhotos(markdown: string | null | undefined): string {
  if (!markdown || typeof markdown !== 'string') return '';
  return markdown.replace(/\/api\/photos\/([\w\-.]+)(\?[^\s\)\"']*)?/g, (_, filename) => {
    const sig = createPhotoSignature(filename);
    return `/api/photos/${filename}?sig=${sig}`;
  });
}
