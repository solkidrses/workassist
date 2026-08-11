import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { isAuthorizedRequest, TELEGRAM_AUTH_ERROR } from '@/lib/requestAuth';

export async function GET(req: Request) {
  if (!isAuthorizedRequest(req)) {
    return NextResponse.json({ error: TELEGRAM_AUTH_ERROR }, { status: 401 });
  }

  try {
    const cpuUsage = execSync("top -bn1 | grep 'Cpu(s)' | awk '{print 100 - $8}'", { encoding: 'utf-8' }).trim();
    const memInfo = execSync("free -m", { encoding: 'utf-8' });
    const memLines = memInfo.trim().split('\n');
    const memParts = memLines[1].trim().split(/\s+/);
    const memTotal = parseInt(memParts[1]);
    const memUsed = parseInt(memParts[2]);

    const dfOutput = execSync("df -B1 /", { encoding: 'utf-8' });
    const dfLines = dfOutput.trim().split('\n');
    const dfParts = dfLines[1].trim().split(/\s+/);
    const diskTotal = parseInt(dfParts[1]);
    const diskUsed = parseInt(dfParts[2]);
    const diskFree = parseInt(dfParts[3]);

    return NextResponse.json({
      success: true,
      data: {
        cpu: Math.round(parseFloat(cpuUsage) || 0),
        memTotal,
        memUsed,
        memPercent: Math.round((memUsed / memTotal) * 100),
        diskTotal,
        diskUsed,
        diskFree,
        diskPercent: Math.round((diskUsed / diskTotal) * 100),
      },
    });
  } catch (error) {
    console.error('Metrics error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
