'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import GPUMonitor from '@/components/GPUMonitor';
import CPUWidget from '@/components/CPUWidget';
import DiskWidget from '@/components/DiskWidget';
import { MainContent, TopBar } from '@/components/layout';
import useCPUInfo from '@/hooks/useCPUInfo';
import useDiskInfo from '@/hooks/useDiskInfo';
import useJobsList from '@/hooks/useJobsList';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const tJobs = useTranslations('jobs');
  const { cpuInfo } = useCPUInfo(5000);
  const { diskInfo } = useDiskInfo(5000);
  const { jobs } = useJobsList({ onlyActive: true, reloadInterval: 5000 });
  const activeTrainJobs = jobs.filter(job => job.job_type === 'train').slice(0, 5);
  const recentInferJobs = jobs.filter(job => job.job_type === 'infer').slice(0, 5);

  return (
    <>
      <TopBar>
        <div>
          <h1 className="text-base sm:text-lg">{tCommon('dashboard')}</h1>
        </div>
      </TopBar>
      <MainContent className="space-y-6">
        <GPUMonitor />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <CPUWidget cpu={cpuInfo} />
          <DiskWidget diskInfo={diskInfo} />
        </div>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('activeTrainJobs')}</h2>
              <Link href="/jobs" className="text-sm text-blue-400">{t('viewAll')}</Link>
            </div>
            <div className="mt-4 space-y-3">
              {activeTrainJobs.length === 0 ? <div className="text-sm text-gray-500">{t('noActiveTrainJobs')}</div> : activeTrainJobs.map(job => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="block rounded-lg border border-gray-800 bg-gray-950 px-4 py-3 hover:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{job.name}</div>
                    <div className="text-xs uppercase text-gray-500">{tJobs(`allStatusesLabel.${job.status}`)}</div>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">GPU {job.gpu_ids} · {job.progress_current}/{job.progress_total || 0}</div>
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('recentInference')}</h2>
              <Link href="/inference" className="text-sm text-blue-400">{tCommon('open')}</Link>
            </div>
            <div className="mt-4 space-y-3">
              {recentInferJobs.length === 0 ? <div className="text-sm text-gray-500">{t('noInferenceJobs')}</div> : recentInferJobs.map(job => (
                <Link key={job.id} href={`/jobs/${job.id}`} className="block rounded-lg border border-gray-800 bg-gray-950 px-4 py-3 hover:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{job.name}</div>
                    <div className="text-xs uppercase text-gray-500">{tJobs(`allStatusesLabel.${job.status}`)}</div>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">GPU {job.gpu_ids} · {job.info || t('inferenceJob')}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </MainContent>
    </>
  );
}
