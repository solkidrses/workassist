import crypto from 'crypto';

export function verifyTelegramInitData(initDataString: string, botToken: string): boolean {
  if (!initDataString) return false;
  try {
    const params = new URLSearchParams(initDataString);
    const hash = params.get('hash');
    if (!hash) return false;

    // Check age of the authentication data (prevent replay attacks)
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 86400) return false; // 24 hours limit

    // Filter, sort alphabetically, and reconstruct check string
    const keys = Array.from(params.keys()).filter(key => key !== 'hash').sort();
    const dataCheckString = keys.map(key => `${key}=${params.get(key)}`).join('\n');

    // Generate secret key using HMAC-SHA256 with "WebAppData" constant key
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    
    // Calculate final hash
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return calculatedHash === hash;
  } catch (error) {
    return false;
  }
}
