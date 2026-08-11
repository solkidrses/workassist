import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { requireAdmin } from '@/lib/requestAuth';

const execFileAsync = promisify(execFile);

export async function GET(req: Request) {
  const adminCheck = await requireAdmin(req);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const { stdout: cpuOut } = await execFileAsync('bash', ['-c', "top -bn1 | grep 'Cpu(s)' | awk '{print 100 - $8}'"]);
    const cpuUsage = cpuOut.trim();

    const { stdout: memInfo } = await execFileAsync('free', ['-m']);
    const memLines = memInfo.trim().split('\n');
    const memParts = memLines[1].trim().split(/\s+/);
    const memTotal = parseInt(memParts[1]);
    const memUsed = parseInt(memParts[2]);

    const { stdout: dfOutput } = await execFileAsync('df', ['-B1', '/']);
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
