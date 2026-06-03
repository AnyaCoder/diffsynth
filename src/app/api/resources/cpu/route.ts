import { NextResponse } from 'next/server';
import si from 'systeminformation';
import { createRequire } from 'module';
import os from 'os';
import { CpuInfo } from '@/types';

const isMac = os.platform() === 'darwin';

export async function GET() {
  try {
    const cpuInfoRaw = await si.cpu();
    let cpuInfo: CpuInfo;

    if (isMac) {
      try {
        const nativeRequire = createRequire(import.meta.url);
        const ms = nativeRequire('macstats') as any;
        const ramData = ms.getRAMUsageSync();
        const cpuData = ms.getCpuDataSync();
        cpuInfo = {
          name: `${cpuInfoRaw.manufacturer} ${cpuInfoRaw.brand}`,
          cores: cpuInfoRaw.cores,
          temperature: cpuData.temperature || 0,
          totalMemory: ramData.total / (1024 * 1024),
          availableMemory: ramData.free / (1024 * 1024),
          freeMemory: ramData.free / (1024 * 1024),
          currentLoad: (await si.currentLoad()).currentLoad || 0,
        };
      } catch {
        const memoryData = await si.mem();
        cpuInfo = {
          name: `${cpuInfoRaw.manufacturer} ${cpuInfoRaw.brand}`,
          cores: cpuInfoRaw.cores,
          temperature: (await si.cpuTemperature()).main || 0,
          totalMemory: memoryData.total / (1024 * 1024),
          availableMemory: memoryData.available / (1024 * 1024),
          freeMemory: memoryData.free / (1024 * 1024),
          currentLoad: (await si.currentLoad()).currentLoad || 0,
        };
      }
    } else {
      const memoryData = await si.mem();
      cpuInfo = {
        name: `${cpuInfoRaw.manufacturer} ${cpuInfoRaw.brand}`,
        cores: cpuInfoRaw.cores,
        temperature: (await si.cpuTemperature()).main || 0,
        totalMemory: memoryData.total / (1024 * 1024),
        availableMemory: memoryData.available / (1024 * 1024),
        freeMemory: memoryData.free / (1024 * 1024),
        currentLoad: (await si.currentLoad()).currentLoad || 0,
      };
    }

    return NextResponse.json(cpuInfo);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch CPU stats' }, { status: 500 });
  }
}
