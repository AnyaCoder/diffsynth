'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/utils/api';
import { InferenceServiceSummary } from '@/types';

export default function useInferenceServices(reloadInterval: number | null = 5000) {
  const [services, setServices] = useState<InferenceServiceSummary[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const refreshServices = async () => {
    setStatus('loading');
    try {
      const data = await apiClient.get('/api/services').then(res => res.data);
      setServices(data.services || []);
      setStatus('success');
    } catch (error) {
      console.error('Error fetching inference services:', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    refreshServices();
    if (!reloadInterval) return;
    const interval = setInterval(refreshServices, reloadInterval);
    return () => clearInterval(interval);
  }, [reloadInterval]);

  return { services, status, refreshServices };
}
