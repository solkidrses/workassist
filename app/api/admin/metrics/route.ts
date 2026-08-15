import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requestAuth';
import fs from 'fs';
import os from 'os';

let lastCpuReading: { used: number; total: number; timestamp: number } | null = null;
let lastCalculatedCpu = 0;

function readCpuJiffies() {
  try {
    const line = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0];
    const parts = line.replace(/^cpu\s+/, '').trim().split(/\s+/).map(Number);
    const [user, nice, system, idle, iowait, irq, softirq, steal, guest, guestNice] = parts;
    const used = user + nice + system + iowait + irq + softirq + steal + (guest || 0) + (guestNice || 0);
    const total = used + idle;
    return { used, total };
  } catch {
    const cpus = os.cpus();
    let used = 0;
    let total = 0;
    for (const cpu of cpus) {
      used += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq;
      total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.irq + cpu.times.idle;
    }
    return { used, total };
  }
}

function getMemoryMetrics() {
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    let memTotalKb = 0;
    let memAvailKb = 0;
    for (const line of meminfo.split('\n')) {
      if (line.startsWith('MemTotal:')) {
        memTotalKb = parseInt(line.replace(/\D/g, ''), 10);
      } else if (line.startsWith('MemAvailable:')) {
        memAvailKb = parseInt(line.replace(/\D/g, ''), 10);
      }
    }
    if (memTotalKb > 0) {
      const memTotal = Math.round(memTotalKb / 1024);
      const memUsed = Math.round((memTotalKb - memAvailKb) / 1024);
      const memPercent = Math.round((memUsed / memTotal) * 100);
      return { memTotal, memUsed, memPercent };
    }
  } catch {}

  const total = Math.round(os.totalmem() / 1048576);
  const free = Math.round(os.freemem() / 1048576);
  const used = total - free;
  return {
    memTotal: total,
    memUsed: used,
    memPercent: total > 0 ? Math.round((used / total) * 100) : 0,
  };
}

function getDiskMetrics() {
  try {
    if (typeof (fs as any).statfsSync === 'function') {
      const stat = (fs as any).statfsSync('/');
      const diskTotal = Number(stat.bsize) * Number(stat.blocks);
      const diskFree = Number(stat.bsize) * Number(stat.bfree);
      const diskUsed = diskTotal - diskFree;
      const diskPercent = diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0;
      return { diskTotal, diskUsed, diskFree, diskPercent };
    }
  } catch {}
  return { diskTotal: 0, diskUsed: 0, diskFree: 0, diskPercent: 0 };
}

export async function GET(req: Request) {
  const adminCheck = await requireAdmin(req);
  if (adminCheck instanceof NextResponse) return adminCheck;

  try {
    const now = Date.now();
    const currentCpu = readCpuJiffies();

    if (lastCpuReading && now - lastCpuReading.timestamp >= 500) {
      const usedDiff = currentCpu.used - lastCpuReading.used;
      const totalDiff = currentCpu.total - lastCpuReading.total;
      lastCalculatedCpu = totalDiff > 0 ? Math.round(Math.max(0, Math.min(100, (usedDiff / totalDiff) * 100))) : 0;
      lastCpuReading = { ...currentCpu, timestamp: now };
    } else if (!lastCpuReading) {
      lastCpuReading = { ...currentCpu, timestamp: now };
      const load = os.loadavg()[0];
      const cpuCount = os.cpus().length || 1;
      lastCalculatedCpu = Math.round(Math.min(100, (load / cpuCount) * 100));
    }

    const mem = getMemoryMetrics();
    const disk = getDiskMetrics();

    return NextResponse.json({
      success: true,
      data: {
        cpu: lastCalculatedCpu,
        memTotal: mem.memTotal,
        memUsed: mem.memUsed,
        memPercent: mem.memPercent,
        diskTotal: disk.diskTotal,
        diskUsed: disk.diskUsed,
        diskFree: disk.diskFree,
        diskPercent: disk.diskPercent,
      },
    });
  } catch (error) {
    console.error('Metrics error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
