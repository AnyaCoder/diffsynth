'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/utils/api';
import { JobResult } from '@/types';

export default function useJobResults(jobID: string, reloadInterval: number | null = 5000) {
  const [results, setResults] = useState<JobResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const refreshResults = useCallback(async () => {
    if (!jobID) return;
    setStatus('loading');
    try {
      const data = await apiClient.get(`/api/jobs/${jobID}/results`).then(res => res.data);
      setResults(data.results || []);
      setStatus('success');
    } catch (error) {
      console.error('Error fetching job results:', error);
      setStatus('error');
    }
  }, [jobID]);

  useEffect(() => {
    if (!jobID) {
      setResults([]);
      setStatus('idle');
      return;
    }
    refreshResults();
    if (!reloadInterval) return;
    const interval = setInterval(refreshResults, reloadInterval);
    return () => clearInterval(interval);
  }, [jobID, reloadInterval, refreshResults]);

  return { results, status, refreshResults };
}
