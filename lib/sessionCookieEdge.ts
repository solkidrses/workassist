const COOKIE_NAME = 'wa_session'

async function importKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await importKey(secret)
  const enc = new TextEncoder()
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function verifySessionEdge(cookieHeader: string | null): Promise<boolean> {
  if (!cookieHeader) return false

  const cookies = cookieHeader.split(';').map(c => c.trim())
  const raw = cookies.find(c => c.startsWith(`${COOKIE_NAME}=`))
  if (!raw) return false

  const value = raw.slice(COOKIE_NAME.length + 1)
  const parts = value.split(':')
  if (parts.length !== 3) return false

  const [telegramId, expiresStr, sig] = parts
  const expires = parseInt(expiresStr, 10)

  if (isNaN(expires) || expires < Math.floor(Date.now() / 1000)) {
    return false
  }

  const botToken = process.env.BOT_TOKEN
  if (!botToken) return false

  const expectedSig = await hmacHex(botToken, `${telegramId}:${expires}`)
  if (sig.length !== expectedSig.length) return false

  // Constant-time comparison
  let diff = 0
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i)
  }
  return diff === 0
}

export { COOKIE_NAME }
