import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { requireAdmin } from '@/lib/requestAuth';
import fs from 'fs';

const execFileAsync = promisify(execFile);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function readCpuJiffies() {
  const line = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0];
  const parts = line.replace(/^cpu\s+/, '').trim().split(/\s+/).map(Number);
  const [user, nice, system, idle, iowait, irq, softirq, steal, guest, guestNice] = parts;
  const used = user + nice + system + iowait + irq + softirq + steal + (guest || 0) + (guestNice || 0);
  const total = used + idle;
  return { used, total };
}

export async function GET(req: Request) {
  const adminCheck = await requireAdmin(req);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const s1 = readCpuJiffies();
    await sleep(1000);
    const s2 = readCpuJiffies();
    const usedDiff = s2.used - s1.used;
    const totalDiff = s2.total - s1.total;
    const cpuUsage = totalDiff > 0 ? Math.round((usedDiff / totalDiff) * 100) : 0;

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
        cpu: cpuUsage,
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
