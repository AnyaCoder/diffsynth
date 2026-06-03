'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/utils/api';
import { SettingsPayload } from '@/types';

export default function useSettings() {
  const [settings, setSettings] = useState<SettingsPayload>({
    DATASETS_ROOT: '',
    TRAINING_ROOT: '',
    INFERENCE_ROOT: '',
    CONDA_ENV_NAME: 'trainer',
  });
  const [isSettingsLoaded, setIsLoaded] = useState(false);

  const refreshSettings = async () => {
    const data = await apiClient.get('/api/settings').then(res => res.data);
    setSettings(data);
    setIsLoaded(true);
  };

  useEffect(() => {
    refreshSettings().catch(error => console.error('Error fetching settings:', error));
  }, []);

  return { settings, setSettings, isSettingsLoaded, refreshSettings };
}
