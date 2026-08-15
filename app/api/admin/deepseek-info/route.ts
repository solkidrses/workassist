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
    const info = data.balance_infos?.[0] || {};
    return NextResponse.json({
      success: true,
      data: {
        isAvailable: data.is_available ?? false,
        totalBalance: info.total_balance ?? '0',
        currency: info.currency ?? 'USD',
        grantedBalance: info.granted_balance ?? '0',
        toppedUpBalance: info.topped_up_balance ?? '0',
        chatModel: 'deepseek-v4-flash',
      },
    });
  } catch (error) {
    console.error('DeepSeek info error:', error);
    return NextResponse.json({ error: 'Failed to fetch DeepSeek balance' }, { status: 500 });
  }
}
