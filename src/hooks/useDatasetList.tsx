'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/utils/api';

export default function useDatasetList(reloadInterval: number | null = null) {
  const [datasets, setDatasets] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const refreshDatasets = async () => {
    setStatus('loading');
    try {
      const data = await apiClient.get('/api/datasets/list').then(res => res.data);
      setDatasets((data.datasets || []).slice().sort((a: string, b: string) => a.localeCompare(b)));
      setStatus('success');
    } catch (error) {
      console.error('Error fetching datasets:', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    refreshDatasets();
    if (!reloadInterval) return;
    const interval = setInterval(refreshDatasets, reloadInterval);
    return () => clearInterval(interval);
  }, [reloadInterval]);

  return { datasets, status, refreshDatasets };
}
