'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/utils/api';
import { QueueInfo } from '@/types';

export default function useQueueList(reloadInterval: number | null = 5000) {
  const [queues, setQueues] = useState<QueueInfo[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const refreshQueues = async () => {
    setStatus('loading');
    try {
      const data = await apiClient.get('/api/queue').then(res => res.data);
      setQueues(data.queues);
      setStatus('success');
    } catch (error) {
      console.error('Error fetching queues:', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    refreshQueues();
    if (!reloadInterval) return;
    const interval = setInterval(refreshQueues, reloadInterval);
    return () => clearInterval(interval);
  }, [reloadInterval]);

  return { queues, status, refreshQueues };
}
