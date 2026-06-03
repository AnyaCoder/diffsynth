'use client';

import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/utils/api';

export default function useServiceLog(serviceId: string, reloadInterval: number | null = 2000) {
  const [log, setLog] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const offsetRef = useRef(0);

  const refresh = async (force = false) => {
    if (!serviceId) return;
    try {
      setStatus(current => (current === 'idle' || force ? 'loading' : current));
      const data = await apiClient
        .get(`/api/services/${serviceId}/log`, { params: { offset: force ? 0 : offsetRef.current } })
        .then(res => res.data);
      if (force || data.reset) {
        setLog(data.full_text || '');
      } else if (data.text) {
        setLog(prev => prev + data.text);
      }
      offsetRef.current = data.offset || 0;
      setStatus('success');
    } catch (error) {
      console.error('Error fetching service log:', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    setLog('');
    offsetRef.current = 0;
    if (!serviceId) return;
    void refresh(true);
    if (!reloadInterval) return;
    const interval = setInterval(refresh, reloadInterval);
    return () => clearInterval(interval);
  }, [serviceId, reloadInterval]);

  return { log, status, refresh };
}
