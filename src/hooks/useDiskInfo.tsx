'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/utils/api';
import { DiskInfo } from '@/types';

export default function useDiskInfo(reloadInterval: number | null = 5000) {
  const [diskInfo, setDiskInfo] = useState<DiskInfo | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const refreshDiskInfo = async () => {
    setStatus('loading');
    try {
      const data = await apiClient.get('/api/resources/disk').then(res => res.data);
      setDiskInfo(data);
      setStatus('success');
    } catch (error) {
      console.error('Error fetching disk info:', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    refreshDiskInfo();
    if (!reloadInterval) return;
    const interval = setInterval(refreshDiskInfo, reloadInterval);
    return () => clearInterval(interval);
  }, [reloadInterval]);

  return { diskInfo, status, refreshDiskInfo };
}
