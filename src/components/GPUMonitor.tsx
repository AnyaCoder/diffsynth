'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { GPUApiResponse } from '@/types';
import Loading from '@/components/Loading';
import GPUWidget from '@/components/GPUWidget';
import { useCurrentLocale } from '@/i18n/useCurrentLocale';
import { apiClient } from '@/utils/api';

export default function GPUMonitor() {
  const tDashboard = useTranslations('dashboard');
  const tResources = useTranslations('resources');
  const locale = useCurrentLocale();
  const [gpuData, setGpuData] = useState<GPUApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await apiClient.get('/api/resources/gpu').then(res => res.data);
        setGpuData(data);
        setLastUpdated(new Date());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, []);

  const content = useMemo(() => {
    if (loading && !gpuData) return <Loading />;
    if (error) return <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-red-200">{error}</div>;
    if (!gpuData?.gpus?.length) return <div className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3 text-gray-400">{tResources('noGpuData')}</div>;
    return <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">{gpuData.gpus.map(gpu => <GPUWidget key={gpu.index} gpu={gpu} />)}</div>;
  }, [error, gpuData, loading, tResources]);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{tDashboard('gpuMonitor')}</h2>
        <div className="text-xs text-gray-500">
          {lastUpdated
            ? tDashboard('updatedAt', {
                time: lastUpdated.toLocaleTimeString(locale === 'zh' ? 'zh-CN' : 'en-US'),
              })
            : ''}
        </div>
      </div>
      {content}
    </section>
  );
}
