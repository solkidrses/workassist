import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requestAuth';

export async function GET(req: Request) {
  const adminCheck = await requireAdmin(req);
  if (adminCheck instanceof NextResponse) return adminCheck;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'DEEPSEEK_API_KEY not configured' }, { status: 500 });
  }

  try {
    const res = await fetch('https://api.deepseek.com/user/balance', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `DeepSeek API error: ${res.status} ${text}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({
      success: true,
      data: {
        balance: data.balance,
        granted: data.granted,
        toppedUp: data.topped_up,
        chatModel: 'deepseek-v4-flash',
        uploadModel: 'deepseek-chat',
      },
    });
  } catch (error) {
    console.error('DeepSeek info error:', error);
    return NextResponse.json({ error: 'Failed to fetch DeepSeek balance' }, { status: 500 });
  }
}
