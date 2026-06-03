'use client';

import { HardDrive } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DiskInfo } from '@/types';

function humanize(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function DiskWidget({ diskInfo }: { diskInfo: DiskInfo | null }) {
  const t = useTranslations('resources');
  if (!diskInfo) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <div className="text-sm text-gray-400">{t('noDiskData')}</div>
      </div>
    );
  }

  const used = diskInfo.totalBytes - diskInfo.freeBytes;
  const ratio = diskInfo.totalBytes > 0 ? (used / diskInfo.totalBytes) * 100 : 0;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-blue-400" />
        <div className="text-sm font-medium text-gray-100">{t('disk')}</div>
      </div>
      <div className="mt-3 text-2xl font-semibold">{humanize(diskInfo.freeBytes)}</div>
      <div className="text-xs text-gray-500">{t('freeOf', { value: humanize(diskInfo.totalBytes) })}</div>
      <div className="mt-3 h-2 rounded-full bg-gray-800">
        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(100, ratio)}%` }} />
      </div>
      <div className="mt-3 space-y-1 text-xs text-gray-400">
        <div>{t('datasetsRoot')}: {diskInfo.datasetsRoot}</div>
        <div>{t('trainingRoot')}: {diskInfo.trainingRoot}</div>
        <div>{t('inferenceRoot')}: {diskInfo.inferenceRoot}</div>
      </div>
    </div>
  );
}
