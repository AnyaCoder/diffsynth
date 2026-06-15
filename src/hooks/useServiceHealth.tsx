'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/utils/api';
import type { InferenceOffloadMode } from '@/types';

export interface ServiceHealth {
  reachable: boolean;
  status?: string;
  endpoint_url?: string | null;
  error?: string;
  service_id?: string;
  name?: string;
  gpu_ids?: string;
  offload_mode?: InferenceOffloadMode;
  port?: number | null;
  use_lora?: boolean;
  base_model?: string;
  checkpoint_path?: string;
  updated_at?: string;
}

export default function useServiceHealth(serviceId: string, reloadInterval: number | null = 5000) {
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const refreshHealth = async () => {
    if (!serviceId) return;
    setStatus('loading');
    try {
      const data = await apiClient.get(`/api/services/${serviceId}/health`).then(res => res.data);
      setHealth(data);
      setStatus('success');
    } catch (error) {
      console.error('Error fetching service health:', error);
      setStatus('error');
    }
  };

  useEffect(() => {
    setHealth(null);
    if (!serviceId) return;
    void refreshHealth();
    if (!reloadInterval) return;
    const interval = setInterval(refreshHealth, reloadInterval);
    return () => clearInterval(interval);
  }, [serviceId, reloadInterval]);

  return { health, status, refreshHealth };
}
