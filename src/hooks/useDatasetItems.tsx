'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/utils/api';
import { DatasetItem } from '@/types';

export default function useDatasetItems(datasetName: string, reloadInterval: number | null = null) {
  const [items, setItems] = useState<DatasetItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const refreshItems = async () => {
    if (!datasetName) return;
    setStatus('loading');
    try {
      const data = await apiClient.get('/api/datasets/items', { params: { datasetName } }).then(res => res.data);
      setItems(data.items || []);
      setStatus('success');
    } catch (error) {
      console.error('Error fetching dataset items:', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    refreshItems();
    if (!reloadInterval) return;
    const interval = setInterval(refreshItems, reloadInterval);
    return () => clearInterval(interval);
  }, [datasetName, reloadInterval]);

  return { items, setItems, status, refreshItems };
}
