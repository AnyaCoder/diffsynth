'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/utils/api';
import { JobArtifact } from '@/types';

export default function useJobArtifacts(jobID: string, reloadInterval: number | null = 5000) {
  const [artifacts, setArtifacts] = useState<JobArtifact[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const refreshArtifacts = async () => {
    setStatus('loading');
    try {
      const data = await apiClient.get(`/api/jobs/${jobID}/artifacts`).then(res => res.data);
      setArtifacts(data.artifacts || []);
      setStatus('success');
    } catch (error) {
      console.error('Error fetching artifacts:', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    if (!jobID) return;
    refreshArtifacts();
    if (!reloadInterval) return;
    const interval = setInterval(refreshArtifacts, reloadInterval);
    return () => clearInterval(interval);
  }, [jobID, reloadInterval]);

  return { artifacts, status, refreshArtifacts };
}
