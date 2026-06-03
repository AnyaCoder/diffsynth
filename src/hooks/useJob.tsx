'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/utils/api';
import { JobSummary } from '@/types';

export default function useJob(jobID: string, reloadInterval: number | null = 5000) {
  const [job, setJob] = useState<JobSummary | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const refreshJob = async () => {
    setStatus('loading');
    try {
      const data = await apiClient.get(`/api/jobs?id=${jobID}`).then(res => res.data);
      setJob(data);
      setStatus('success');
    } catch (error) {
      console.error('Error fetching job:', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    if (!jobID) return;
    refreshJob();
    if (!reloadInterval) return;
    const interval = setInterval(refreshJob, reloadInterval);
    return () => clearInterval(interval);
  }, [jobID, reloadInterval]);

  return { job, status, refreshJob };
}
