'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/utils/api';
import { JobSummary } from '@/types';

export default function useJobsList({
  onlyActive = false,
  reloadInterval = 5000,
  jobType,
  includeArchived = false,
}: {
  onlyActive?: boolean;
  reloadInterval?: number | null;
  jobType?: string;
  includeArchived?: boolean;
} = {}) {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const refreshJobs = async () => {
    setStatus('loading');
    try {
      const data = await apiClient
        .get('/api/jobs', {
          params: {
            ...(jobType ? { job_type: jobType } : {}),
            ...(includeArchived ? { include_archived: true } : {}),
          },
        })
        .then(res => res.data);
      const nextJobs = onlyActive ? data.jobs.filter((job: JobSummary) => ['running', 'queued', 'stopping'].includes(job.status)) : data.jobs;
      setJobs(nextJobs);
      setStatus('success');
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    refreshJobs();
    if (!reloadInterval) return;
    const interval = setInterval(refreshJobs, reloadInterval);
    return () => clearInterval(interval);
  }, [jobType, reloadInterval, onlyActive, includeArchived]);

  return { jobs, status, refreshJobs };
}
