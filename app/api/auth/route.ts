import { NextResponse } from 'next/server'
import { verifyTelegramInitData } from '@/lib/telegramAuth'
import { sessionCookieHeader } from '@/lib/sessionCookie'

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'production') {
    const res = NextResponse.json({ success: true })
    res.headers.set('Set-Cookie', sessionCookieHeader('dev'))
    return res
  }

  const body = await req.json().catch(() => null)
  if (!body || !body.initData) {
    return NextResponse.json({ error: 'Missing initData' }, { status: 400 })
  }

  const botToken = process.env.BOT_TOKEN
  if (!botToken) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  if (!verifyTelegramInitData(body.initData, botToken)) {
    return NextResponse.json({ error: 'Invalid initData' }, { status: 403 })
  }

  // Extract telegramId from initData
  try {
    const params = new URLSearchParams(body.initData)
    const userJson = params.get('user')
    if (!userJson) {
      return NextResponse.json({ error: 'No user data' }, { status: 400 })
    }
    const user = JSON.parse(userJson)
    if (!user.id) {
      return NextResponse.json({ error: 'No user id' }, { status: 400 })
    }

    const res = NextResponse.json({ success: true })
    res.headers.set('Set-Cookie', sessionCookieHeader(String(user.id)))
    return res
  } catch {
    return NextResponse.json({ error: 'Parse error' }, { status: 400 })
  }
}
