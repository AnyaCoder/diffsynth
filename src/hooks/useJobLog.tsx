'use client';

import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/utils/api';

export default function useJobLog(jobID: string, reloadInterval: number | null = 2000) {
  const [log, setLog] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const offsetRef = useRef(0);

  const refresh = async (force = false) => {
    try {
      setStatus(current => (current === 'idle' || force ? 'loading' : current));
      const data = await apiClient
        .get(`/api/jobs/${jobID}/log`, { params: { offset: force ? 0 : offsetRef.current } })
        .then(res => res.data);
      if (force || data.reset) {
        setLog(data.full_text || '');
      } else if (data.text) {
        setLog(prev => prev + data.text);
      }
      offsetRef.current = data.offset || 0;
      setStatus('success');
    } catch (error) {
      console.error('Error fetching log:', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    if (!jobID) return;
    setLog('');
    offsetRef.current = 0;
    refresh(true);
    if (!reloadInterval) return;
    const interval = setInterval(refresh, reloadInterval);
    return () => clearInterval(interval);
  }, [jobID, reloadInterval]);

  return { log, status, refresh };
}
