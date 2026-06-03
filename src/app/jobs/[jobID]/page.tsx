'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import InferenceGallery from '@/components/InferenceGallery';
import { useToast } from '@/components/ToastProvider';
import { MainContent, TopBar } from '@/components/layout';
import useJob from '@/hooks/useJob';
import useJobLog from '@/hooks/useJobLog';
import useJobResults from '@/hooks/useJobResults';
import { JobResult } from '@/types';
import { apiClient } from '@/utils/api';

export default function JobDetailPage({ params }: { params: Promise<{ jobID: string }> }) {
  const t = useTranslations('jobDetail');
  const tJobs = useTranslations('jobs');
  const tCommon = useTranslations('common');
  const { pushToast } = useToast();
  const [jobId, setJobId] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [autoRefreshLog, setAutoRefreshLog] = useState(true);
  const [previewImage, setPreviewImage] = useState<JobResult | null>(null);

  useEffect(() => {
    params.then(value => setJobId(value.jobID));
  }, [params]);

  const { job, refreshJob } = useJob(jobId, 5000);
  const { log, refresh: refreshLog } = useJobLog(jobId, autoRefreshLog ? 2000 : null);
  const { results, refreshResults } = useJobResults(jobId, 5000);

  const start = async () => {
    await apiClient.post(`/api/jobs/${jobId}/start`);
    pushToast({ title: t('start'), description: job?.name || jobId, tone: 'info' });
    refreshJob();
  };

  const stop = async () => {
    await apiClient.post(`/api/jobs/${jobId}/stop`);
    pushToast({ title: t('stop'), description: job?.name || jobId, tone: 'warning' });
    refreshJob();
  };

  const toggleArchive = async () => {
    await apiClient.post(`/api/jobs/${jobId}/archive`, { archived: !job?.is_archived });
    pushToast({ title: job?.is_archived ? t('unarchive') : t('archive'), description: job?.name || jobId, tone: 'info' });
    refreshJob();
  };

  const deleteJob = async () => {
    if (!job) return;
    setIsDeleting(true);
    await apiClient.post(`/api/jobs/${jobId}/delete`);
    pushToast({ title: tCommon('delete'), description: job.name, tone: 'warning' });
    setDeleteOpen(false);
    window.location.href = '/jobs';
  };

  const primaryResult = results[0] ?? null;
  const isInferJob = job?.job_type === 'infer';
  const trainingProgress = parseTrainingProgressLog(log);

  return (
    <>
      <TopBar>
        <h1 className="text-base sm:text-lg">{job?.name || t('title')}</h1>
        <div className="flex-1" />
        <div className="flex gap-2">
          <button onClick={start} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">{t('start')}</button>
          <button onClick={stop} className="rounded-lg border border-red-900 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/40">{t('stop')}</button>
          {job && !['queued', 'running', 'stopping'].includes(job.status) ? (
            <button onClick={toggleArchive} className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium hover:border-gray-600">
              {job.is_archived ? t('unarchive') : t('archive')}
            </button>
          ) : null}
          {job && !['running', 'stopping'].includes(job.status) ? (
            <button onClick={() => setDeleteOpen(true)} className="rounded-lg border border-red-900 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/40">{tCommon('delete')}</button>
          ) : null}
          {job?.job_type === 'train' ? <Link href={`/inference?trainJobId=${jobId}`} className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium hover:border-gray-600">{t('useInInference')}</Link> : null}
        </div>
      </TopBar>
      <MainContent className="space-y-6">
        {isInferJob ? (
          <>
            <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{t('resultPreview')}</h2>
                <button onClick={refreshResults} className="text-sm text-blue-400">{tCommon('refresh')}</button>
              </div>
              <div className="mt-5">
                <InferenceGallery items={results} emptyLabel={t('noResults')} onOpen={setPreviewImage} hero />
              </div>
            </section>

            <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
              <h2 className="text-lg font-semibold">{t('overview')}</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Stat label={t('type')} value={job ? (job.job_type === 'train' ? tJobs('train') : tJobs('infer')) : '-'} />
                <Stat label={t('status')} value={job ? tJobs(`allStatusesLabel.${job.status}`) : '-'} />
              </div>
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DetailBlock label={t('servedBy')} value={primaryResult?.served_by === 'service' ? t('servedByService') : t('servedByEphemeral')} />
                <DetailBlock label={t('checkpoint')} value={primaryResult?.checkpoint_path || '-'} />
                <DetailBlock label={t('seed')} value={String(primaryResult?.seed ?? '-')} />
                <DetailBlock label={t('steps')} value={String(primaryResult?.num_inference_steps ?? '-')} />
              </div>
              <div className="mt-5 rounded-xl border border-gray-800 bg-gray-950 px-4 py-4">
                <div className="text-xs uppercase tracking-[0.2em] text-gray-500">{t('prompt')}</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-gray-200">{primaryResult?.prompt || job?.info || t('noStatusMessage')}</div>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <h2 className="text-lg font-semibold">{t('overview')}</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Stat label={t('type')} value={job ? (job.job_type === 'train' ? tJobs('train') : tJobs('infer')) : '-'} />
                <Stat label={t('status')} value={job ? tJobs(`allStatusesLabel.${job.status}`) : '-'} />
                <Stat label={t('archived')} value={job?.is_archived ? t('yes') : t('no')} />
                <Stat label={t('gpu')} value={job?.gpu_ids || '-'} />
              </div>
              <TrainingProgressPanel
                title={t('trainingProgress')}
                stepProgressLabel={t('stepProgress')}
                epochProgressLabel={t('epochProgress')}
                activeStepLabel={t('activeStep')}
                etaLabel={t('eta')}
                speedLabel={t('speed')}
                elapsedLabel={t('elapsed')}
                pendingLabel={t('liveProgressPending')}
                info={job?.info || t('noStatusMessage')}
                stepProgress={trainingProgress}
                epochCurrent={job?.progress_current ?? 0}
                epochTotal={job?.progress_total ?? 0}
                evalResults={results}
              />
            </section>

            <section className="grid min-h-0 grid-cols-1 gap-6 xl:h-[calc(100vh-17rem)] xl:grid-cols-2">
              <div className="flex min-h-0 flex-col rounded-xl border border-gray-800 bg-gray-900 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">{t('log')}</h2>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-400">
                      <input
                        type="checkbox"
                        checked={autoRefreshLog}
                        onChange={event => setAutoRefreshLog(event.target.checked)}
                      />
                      {t('logAutoRefresh')}
                    </label>
                    <button
                      onClick={() => refreshLog(true)}
                      className="text-sm text-blue-400"
                    >
                      {t('refreshLog')}
                    </button>
                  </div>
                </div>
                <pre className="mt-4 min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-800 bg-gray-950 p-4 text-xs text-gray-300">{log || t('waitingForLog')}</pre>
              </div>

              <div className="flex min-h-0 flex-col rounded-xl border border-gray-800 bg-gray-900 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{t('evalTimeline')}</h2>
                  <button onClick={refreshResults} className="text-sm text-blue-400">{tCommon('refresh')}</button>
                </div>
                <div className="mt-4 min-h-0 flex-1 overflow-auto">
                  <div className="space-y-4">
                    {results.map(result => (
                      <button
                        key={result.image_path}
                        type="button"
                        onClick={() => setPreviewImage(result)}
                        className="block w-full rounded-xl border border-gray-800 bg-gray-950 p-3 text-left transition hover:border-cyan-700/60"
                      >
                        <img src={result.image_url} alt="result" className="h-72 w-full rounded-lg object-cover" />
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {typeof result.step === 'number' ? <EvalChip>{t('stepAt', { value: result.step })}</EvalChip> : null}
                          {typeof result.epoch === 'number' ? <EvalChip>{t('epochAt', { value: result.epoch })}</EvalChip> : null}
                          <EvalChip>{t('seed')}: {result.seed}</EvalChip>
                          <EvalChip>{t('steps')}: {result.num_inference_steps}</EvalChip>
                        </div>
                        <div className="mt-3 line-clamp-2 text-sm text-gray-300">{result.prompt}</div>
                        <div className="mt-2 text-xs text-gray-500">{formatDateTime(result.created_at)}</div>
                      </button>
                    ))}
                    {results.length === 0 ? <div className="text-sm text-gray-500">{t('noEvalResults')}</div> : null}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </MainContent>
      <ConfirmDialog
        open={deleteOpen}
        title={tCommon('delete')}
        message={job ? t('deleteSingleMessage', { name: job.name }) : ''}
        confirmLabel={tCommon('delete')}
        cancelLabel={tCommon('cancel')}
        busyLabel={tCommon('working')}
        tone="danger"
        busy={isDeleting}
        onCancel={() => {
          if (isDeleting) return;
          setDeleteOpen(false);
        }}
        onConfirm={async () => {
          try {
            await deleteJob();
          } catch (error) {
            console.error('Failed to delete job', error);
            setIsDeleting(false);
          }
        }}
      />
      {previewImage ? (
        <button
          type="button"
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-md"
          aria-label={t('closePreview')}
        >
          <div className="relative max-h-full max-w-7xl">
            <img
              src={previewImage.image_url}
              alt={previewImage.prompt || 'result preview'}
              className="max-h-[88vh] max-w-[92vw] rounded-2xl border border-white/10 bg-black object-contain shadow-2xl"
            />
          </div>
        </button>
      ) : null}
    </>
  );
}

interface ParsedTrainingProgress {
  percent: number;
  currentStep: number;
  totalStep: number;
  elapsed: string;
  eta: string;
  speed: string;
}

function parseTrainingProgressLog(log: string): ParsedTrainingProgress | null {
  if (!log) return null;

  const cleaned = log.replace(/\u001b\[[0-9;]*m/g, '');
  const lines = cleaned
    .split(/[\r\n]+/)
    .map(line => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    const match = line.match(/(\d+)%.*?(\d+)\/(\d+)\s*\[([^<\]]+)<([^,\]]+),\s*([^\]]+)\]/);
    if (!match) continue;

    const [, percent, currentStep, totalStep, elapsed, eta, speed] = match;
    return {
      percent: clampPercent(Number(percent)),
      currentStep: Number(currentStep),
      totalStep: Number(totalStep),
      elapsed: elapsed.trim(),
      eta: eta.trim(),
      speed: speed.trim(),
    };
  }

  return null;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function TrainingProgressPanel({
  title,
  stepProgressLabel,
  epochProgressLabel,
  activeStepLabel,
  etaLabel,
  speedLabel,
  elapsedLabel,
  pendingLabel,
  info,
  stepProgress,
  epochCurrent,
  epochTotal,
  evalResults,
}: {
  title: string;
  stepProgressLabel: string;
  epochProgressLabel: string;
  activeStepLabel: string;
  etaLabel: string;
  speedLabel: string;
  elapsedLabel: string;
  pendingLabel: string;
  info: string;
  stepProgress: ParsedTrainingProgress | null;
  epochCurrent: number;
  epochTotal: number;
  evalResults: JobResult[];
}) {
  const hasStepProgress = Boolean(stepProgress && stepProgress.totalStep > 0);
  const livePercent = hasStepProgress ? stepProgress!.percent : 0;
  const epochPercent = epochTotal > 0 ? clampPercent((epochCurrent / epochTotal) * 100) : 0;
  const evalMarkers =
    hasStepProgress && stepProgress
      ? evalResults
          .map(result => result.step)
          .filter((value): value is number => typeof value === 'number')
          .map(step => ({
            left: stepProgress.totalStep > 0 ? clampPercent((step / stepProgress.totalStep) * 100) : 0,
            label: String(step),
          }))
      : [];

  return (
    <div className="mt-5 rounded-2xl border border-cyan-950/70 bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.14),_transparent_36%),linear-gradient(180deg,rgba(17,24,39,0.96),rgba(3,7,18,0.98))] p-5 shadow-[0_16px_50px_rgba(0,0,0,0.28)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-300/75">{title}</div>
          <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
            <div className="text-4xl font-semibold text-white tabular-nums">{hasStepProgress ? `${livePercent}%` : `${epochPercent}%`}</div>
            <div className="pb-1 text-sm text-gray-400">
              {hasStepProgress && stepProgress ? `${stepProgress.currentStep}/${stepProgress.totalStep}` : pendingLabel}
            </div>
          </div>
          <div className="mt-3 max-w-3xl text-sm text-gray-400">{info}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:min-w-[24rem]">
          <ProgressMeta label={activeStepLabel} value={hasStepProgress && stepProgress ? `${stepProgress.currentStep}/${stepProgress.totalStep}` : '-'} />
          <ProgressMeta label={etaLabel} value={hasStepProgress && stepProgress ? stepProgress.eta : '-'} />
          <ProgressMeta label={speedLabel} value={hasStepProgress && stepProgress ? stepProgress.speed : '-'} />
          <ProgressMeta label={elapsedLabel} value={hasStepProgress && stepProgress ? stepProgress.elapsed : '-'} />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <ProgressBar
          label={stepProgressLabel}
          valueLabel={hasStepProgress && stepProgress ? `${stepProgress.currentStep}/${stepProgress.totalStep}` : pendingLabel}
          percent={livePercent}
          fillClassName="from-cyan-400 via-sky-400 to-blue-500"
          glowClassName="shadow-[0_0_24px_rgba(34,211,238,0.35)]"
          markers={evalMarkers}
        />
        <ProgressBar
          label={epochProgressLabel}
          valueLabel={epochTotal > 0 ? `${epochCurrent}/${epochTotal}` : '-'}
          percent={epochPercent}
          fillClassName="from-fuchsia-400 via-violet-400 to-indigo-500"
          glowClassName="shadow-[0_0_24px_rgba(168,85,247,0.28)]"
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
      <div className="text-xs uppercase tracking-[0.2em] text-gray-500">{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-4">
      <div className="text-xs uppercase tracking-[0.2em] text-gray-500">{label}</div>
      <div className="mt-2 break-all text-sm text-gray-200">{value}</div>
    </div>
  );
}

function ProgressBar({
  label,
  valueLabel,
  percent,
  fillClassName,
  glowClassName,
  markers = [],
}: {
  label: string;
  valueLabel: string;
  percent: number;
  fillClassName: string;
  glowClassName: string;
  markers?: Array<{ left: number; label: string }>;
}) {
  const clampedPercent = clampPercent(percent);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-[0.22em] text-gray-500">
        <span>{label}</span>
        <span className="truncate text-right text-[11px] text-gray-400">{valueLabel}</span>
      </div>
      <div className="relative mt-2 h-3 overflow-visible rounded-full border border-white/5 bg-gray-950/90">
        <div
          className={`h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out ${fillClassName} ${glowClassName}`}
          style={{ width: `${clampedPercent}%` }}
        />
        {markers.map(marker => (
          <div
            key={`${label}-${marker.label}-${marker.left}`}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${marker.left}%` }}
            title={marker.label}
          >
            <div className="h-5 w-[2px] rounded-full bg-white/70 shadow-[0_0_12px_rgba(255,255,255,0.4)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/30 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-gray-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-gray-100 tabular-nums">{value}</div>
    </div>
  );
}

function EvalChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-cyan-900/60 bg-cyan-950/40 px-3 py-1 text-xs text-cyan-200">
      {children}
    </span>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
