'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import InferenceResultFeed, { InferenceHistoryItem } from '@/components/InferenceResultFeed';
import ModelSourceSelect from '@/components/ModelSourceSelect';
import ResizableSplitPanel from '@/components/ResizableSplitPanel';
import { useToast } from '@/components/ToastProvider';
import { MainContent, TopBar } from '@/components/layout';
import { buildModelSourceConfig, matchesInferenceServiceForModelSource } from '@/domain/modelSource';
import useInferenceServices from '@/hooks/useInferenceServices';
import useGPUInfo from '@/hooks/useGPUInfo';
import useJobsList from '@/hooks/useJobsList';
import useModelSourceSelection from '@/hooks/useModelSourceSelection';
import useRecentInferenceResults from '@/hooks/useRecentInferenceResults';
import { apiClient } from '@/utils/api';
import { InferenceServiceSummary, JobResult } from '@/types';

export default function InferencePage() {
  const t = useTranslations('inferencePage');
  const tGallery = useTranslations('inferenceGallery');
  const { pushToast } = useToast();
  const { gpuList } = useGPUInfo(null, 5000);
  const { jobs } = useJobsList({ jobType: 'train', reloadInterval: 5000 });
  const { services } = useInferenceServices(5000);
  const { results: recentResults, refreshResults: refreshRecentResults } = useRecentInferenceResults(16, 5000);
  const [name, setName] = useState(`infer_${Date.now()}`);
  const [prompt, setPrompt] = useState('精致肖像，水下少女，蓝裙飘逸，发丝轻扬，光影透澈，气泡环绕，面容恬静，细节精致，梦幻唯美。');
  const [seed, setSeed] = useState(0);
  const [steps, setSteps] = useState(40);
  const [gpuIds, setGpuIds] = useState('');
  const [outputPrefix, setOutputPrefix] = useState('image');
  const [history, setHistory] = useState<InferenceHistoryItem[]>([]);
  const [favoriteImagePaths, setFavoriteImagePaths] = useState<string[]>([]);
  const [isSubmittingReplay, setIsSubmittingReplay] = useState(false);
  const [isSubmittingInference, setIsSubmittingInference] = useState(false);
  const [serviceStrategy, setServiceStrategy] = useState<'auto' | 'manual'>('auto');
  const [selectedServiceId, setSelectedServiceId] = useState('');

  const {
    checkpointPath,
    modelSourceOptions,
    selectedModelSource,
    selectModelSource,
    setCheckpointPath,
    setSourceTrainJobId,
  } = useModelSourceSelection({
    jobs,
    baseLabel: t('baseModelOption'),
  });

  const matchingServices = useMemo(
    () =>
      services.filter(service =>
        matchesInferenceServiceForModelSource(service, {
          gpuIds,
          selectedModelSource,
          checkpointPath,
        })
      ),
    [services, gpuIds, selectedModelSource, checkpointPath]
  );

  useEffect(() => {
    if (!gpuIds && gpuList[0]) setGpuIds(String(gpuList[0].index));
  }, [gpuList, gpuIds]);

  useEffect(() => {
    const trainJobId = new URLSearchParams(window.location.search).get('trainJobId');
    if (trainJobId) {
      setSourceTrainJobId(trainJobId);
    }
  }, []);

  useEffect(() => {
    if (serviceStrategy !== 'manual') return;
    if (selectedServiceId && matchingServices.some(service => service.id === selectedServiceId)) {
      return;
    }
    setSelectedServiceId(matchingServices[0]?.id || '');
  }, [matchingServices, selectedServiceId, serviceStrategy]);

  const runInference = async () => {
    if (isSubmittingInference) return;
    setIsSubmittingInference(true);
    try {
      const response = await apiClient.post('/api/jobs', {
        name,
        job_type: 'infer',
        config: {
          prompt,
          seed,
          num_inference_steps: steps,
          output_prefix: outputPrefix,
          gpu_ids: gpuIds,
          ...buildModelSourceConfig(selectedModelSource, checkpointPath),
          preferred_service_id: serviceStrategy === 'manual' ? selectedServiceId || null : null,
        },
      });
      const created = response.data;
      await apiClient.post(`/api/jobs/${created.id}/start`);
      setHistory(prev => [{ id: created.id, name: created.name, info: t('started') }, ...prev]);
      pushToast({ title: t('runInference'), description: created.name, tone: 'info' });
      refreshRecentResults();
    } finally {
      setIsSubmittingInference(false);
    }
  };

  const applyResultToForm = (item: JobResult) => {
    setPrompt(item.prompt || '');
    setSeed(item.seed);
    setSteps(item.num_inference_steps);
    setCheckpointPath(item.checkpoint_path || '');
    setSourceTrainJobId(item.source_train_job_id ?? null);
    if (item.gpu_ids) {
      setGpuIds(item.gpu_ids);
    }
    pushToast({ title: tGallery('reuseToastTitle'), description: item.job_name || tGallery('untitled'), tone: 'info' });
  };

  const replayResult = async (item: JobResult) => {
    if (isSubmittingReplay) {
      return;
    }
    setIsSubmittingReplay(true);
    try {
      const replayName = `infer_${Date.now()}`;
      const response = await apiClient.post('/api/jobs', {
        name: replayName,
        job_type: 'infer',
        config: {
          prompt: item.prompt,
          seed: item.seed,
          num_inference_steps: item.num_inference_steps,
          output_prefix: outputPrefix,
          gpu_ids: item.gpu_ids || gpuIds,
          checkpoint_path: item.checkpoint_path,
          base_model: item.base_model || 'Qwen/Qwen-Image-2512',
          use_lora: item.use_lora,
          source_train_job_id: item.source_train_job_id ?? null,
          preferred_service_id: item.service_id ?? null,
        },
      });
      const created = response.data;
      await apiClient.post(`/api/jobs/${created.id}/start`);
      setHistory(prev => [{ id: created.id, name: created.name, info: tGallery('rerunQueued') }, ...prev]);
      pushToast({ title: tGallery('rerunToastTitle'), description: created.name, tone: 'success' });
      refreshRecentResults();
    } finally {
      setIsSubmittingReplay(false);
    }
  };

  const toggleFavorite = (item: JobResult) => {
    setFavoriteImagePaths(prev =>
      prev.includes(item.image_path)
        ? prev.filter(path => path !== item.image_path)
        : [item.image_path, ...prev].slice(0, 32)
    );
  };

  const deleteResultJob = async (item: JobResult) => {
    if (!item.job_id) return;
    await apiClient.post(`/api/jobs/${item.job_id}/delete`);
    setHistory(prev => prev.filter(entry => entry.id !== item.job_id));
    refreshRecentResults();
  };

  return (
    <>
      <TopBar>
        <h1 className="text-base sm:text-lg">{t('title')}</h1>
      </TopBar>
      <MainContent>
        <ResizableSplitPanel
          defaultLeftWidth={760}
          minLeftWidth={620}
          maxLeftWidth={940}
          rightMinWidthClassName="xl:min-w-[360px]"
          left={
            <div data-panel-role="infer-left" className="rounded-xl border border-gray-800 bg-gray-900 p-5 xl:flex-1">
          <h2 className="text-lg font-semibold">{t('formTitle')}</h2>
          <div className="mt-5 grid grid-cols-1 gap-4">
            <Field label={t('jobName')} value={name} onChange={setName} />
            <Field label={t('prompt')} value={prompt} onChange={setPrompt} textarea />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <NumberField label={t('seed')} value={seed} onChange={setSeed} />
              <NumberField label={t('steps')} value={steps} onChange={setSteps} />
              <Field label={t('gpuId')} value={gpuIds} onChange={setGpuIds} />
            </div>
            <Field label={t('outputPrefix')} value={outputPrefix} onChange={setOutputPrefix} />
              <ModelSourceSelect
                label={t('modelSource')}
                options={modelSourceOptions}
                value={selectedModelSource}
                onChange={selectModelSource}
                kindLabels={{ base: t('baseModelTag'), lora: t('loraTag') }}
              />
            <div className="rounded-lg border border-cyan-900/60 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-100">
              {t('serviceReuseHint')}
            </div>
            <ServiceReusePanel
              strategy={serviceStrategy}
              onChangeStrategy={setServiceStrategy}
              services={matchingServices}
              selectedServiceId={selectedServiceId}
              onSelectService={setSelectedServiceId}
              t={t}
            />
            {selectedModelSource.kind === 'lora' ? (
              <div className="rounded-lg border border-amber-900/70 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
                {t('checkpointAutoFill')}
              </div>
            ) : null}
            <Field label={t('checkpointPath')} value={checkpointPath} onChange={setCheckpointPath} />
            <button
              onClick={runInference}
              disabled={isSubmittingInference}
              className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmittingInference ? t('started') : t('runInference')}
            </button>
          </div>
          </div>
          }
          right={
            <InferenceResultFeed
              results={recentResults}
              history={history}
              favoriteImagePaths={favoriteImagePaths}
              onRefresh={refreshRecentResults}
              onToggleFavorite={toggleFavorite}
              onReuse={applyResultToForm}
              onReplay={replayResult}
              onDelete={deleteResultJob}
            />
          }
        />
      </MainContent>
    </>
  );
}

function ServiceReusePanel({
  strategy,
  onChangeStrategy,
  services,
  selectedServiceId,
  onSelectService,
  t,
}: {
  strategy: 'auto' | 'manual';
  onChangeStrategy: (value: 'auto' | 'manual') => void;
  services: InferenceServiceSummary[];
  selectedServiceId: string;
  onSelectService: (value: string) => void;
  t: ReturnType<typeof useTranslations<'inferencePage'>>;
}) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/70 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="text-sm font-medium text-gray-200">{t('serviceModeLabel')}</div>
      <div className="mt-3 inline-flex rounded-2xl border border-gray-700 bg-gray-950 p-1">
        <button
          type="button"
          onClick={() => onChangeStrategy('auto')}
          className={`relative rounded-xl px-4 py-2.5 text-xs font-medium uppercase tracking-[0.18em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 ${
            strategy === 'auto'
              ? 'border border-cyan-800 bg-cyan-950/70 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.1)]'
              : 'border border-transparent text-gray-400 hover:bg-gray-900 hover:text-gray-100 active:bg-gray-800'
          }`}
        >
          {t('serviceModeAuto')}
        </button>
        <button
          type="button"
          onClick={() => onChangeStrategy('manual')}
          className={`relative rounded-xl px-4 py-2.5 text-xs font-medium uppercase tracking-[0.18em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 ${
            strategy === 'manual'
              ? 'border border-cyan-800 bg-cyan-950/70 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.1)]'
              : 'border border-transparent text-gray-400 hover:bg-gray-900 hover:text-gray-100 active:bg-gray-800'
          }`}
        >
          {t('serviceModeManual')}
        </button>
      </div>
      <div className="mt-3 text-sm text-gray-400">
        {strategy === 'auto' ? t('serviceModeAutoHelp') : t('serviceModeManualHelp')}
      </div>
      {strategy === 'manual' ? (
        <div className="mt-4 space-y-2">
          {services.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-700 bg-gray-950/60 px-4 py-4 text-sm text-gray-500">
              {t('noMatchingService')}
            </div>
          ) : (
            services.map(service => (
              <button
                key={service.id}
                type="button"
                onClick={() => onSelectService(service.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  selectedServiceId === service.id
                    ? 'border-cyan-800 bg-cyan-950/40'
                    : 'border-gray-700 bg-gray-950/70 hover:border-gray-600 hover:bg-gray-950'
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white/88">{service.name}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/42">
                    GPU {service.gpu_ids} · {service.use_lora ? t('loraTag') : t('baseModelTag')}
                  </div>
                </div>
                <div className="shrink-0 rounded-full border border-gray-700 bg-gray-900 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/62">
                  {service.status}
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value, onChange, textarea = false }: { label: string; value: string; onChange: (value: string) => void; textarea?: boolean }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-gray-300">{label}</div>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} className="min-h-32 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500" />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500" />
      )}
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-gray-300">{label}</div>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500" />
    </label>
  );
}
