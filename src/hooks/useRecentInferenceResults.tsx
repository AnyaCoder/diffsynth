'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/utils/api';
import { JobResult } from '@/types';

export default function useRecentInferenceResults(limit = 18, reloadInterval: number | null = 5000) {
  const [results, setResults] = useState<JobResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const refreshResults = async () => {
    setStatus('loading');
    try {
      const data = await apiClient
        .get('/api/jobs', {
          params: { recent_infer_results: true, limit },
        })
        .then(res => res.data);
      setResults(data.results || []);
      setStatus('success');
    } catch (error) {
      console.error('Error fetching recent inference results:', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    refreshResults();
    if (!reloadInterval) return;
    const interval = setInterval(refreshResults, reloadInterval);
    return () => clearInterval(interval);
  }, [limit, reloadInterval]);

  return { results, status, refreshResults };
}
