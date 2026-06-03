import { execSync } from 'child_process';

export function stopPidTree(pid: number) {
  if (!pid) return;
  try {
    execSync(`kill -TERM -${pid}`, { stdio: 'ignore' });
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // ignore
    }
  }
}

export function isGpuBusy(targetGpuIds: string, busyGpuIds: string[]) {
  const wanted = new Set(targetGpuIds.split(',').map(i => i.trim()).filter(Boolean));
  return busyGpuIds.some(ids => ids.split(',').map(i => i.trim()).some(id => wanted.has(id)));
}
