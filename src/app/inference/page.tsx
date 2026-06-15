'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Play, Power, PowerOff, RefreshCw, SlidersHorizontal, Tags } from 'lucide-react';
import InferenceOutputPanel, { InferenceHistoryItem } from '@/components/InferenceOutputPanel';
import ModelSourceSelect from '@/components/ModelSourceSelect';
import { useToast } from '@/components/ToastProvider';
import { MainContent, TopBar } from '@/components/layout';
import {
  buildInferencePrompt,
  DEFAULT_INFERENCE_PROMPT_SELECTION,
  getPromptGroupOptions,
  getSelectedInferencePromptOptions,
  INFERENCE_PROMPT_GROUPS,
  InferencePromptGroup,
  InferencePromptGroupId,
  InferencePromptOption,
  InferencePromptSelection,
  normalizeInferencePromptSelection,
} from '@/domain/inferencePrompt';
import { buildModelSourceConfig, DEFAULT_INFERENCE_BASE_MODEL } from '@/domain/modelSource';
import useInferenceServices from '@/hooks/useInferenceServices';
import useGPUInfo from '@/hooks/useGPUInfo';
import useJob from '@/hooks/useJob';
import useJobResults from '@/hooks/useJobResults';
import useJobsList from '@/hooks/useJobsList';
import useModelSourceSelection from '@/hooks/useModelSourceSelection';
import useRecentInferenceResults from '@/hooks/useRecentInferenceResults';
import { apiClient } from '@/utils/api';
import { InferenceServiceSummary, JobResult, JobSummary } from '@/types';

const GPU_IDS_STORAGE_KEY = 'qwen.inference.gpuIds';

export default function InferencePage() {
  const t = useTranslations('inferencePage');
  const tGallery = useTranslations('inferenceGallery');
  const { pushToast } = useToast();
  const { gpuList } = useGPUInfo(null, 5000);
  const { jobs } = useJobsList({ jobType: 'train', reloadInterval: 5000 });
  const { services, refreshServices } = useInferenceServices(2500);
  const { results: recentResults, refreshResults: refreshRecentResults } = useRecentInferenceResults(16, 5000);
  const [name, setName] = useState(`infer_${Date.now()}`);
  const [promptSelection, setPromptSelection] = useState<InferencePromptSelection>(DEFAULT_INFERENCE_PROMPT_SELECTION);
  const [seed, setSeed] = useState(0);
  const [steps, setSteps] = useState(40);
  const [gpuIds, setGpuIds] = useState('');
  const [gpuIdsRestored, setGpuIdsRestored] = useState(false);
  const [userChangedGpuIds, setUserChangedGpuIds] = useState(false);
  const [outputPrefix, setOutputPrefix] = useState('image');
  const [history, setHistory] = useState<InferenceHistoryItem[]>([]);
  const [favoriteImagePaths, setFavoriteImagePaths] = useState<string[]>([]);
  const [isSubmittingReplay, setIsSubmittingReplay] = useState(false);
  const [isSubmittingInference, setIsSubmittingInference] = useState(false);
  const [modelAction, setModelAction] = useState<'load' | 'unload' | null>(null);
  const [activeInference, setActiveInference] = useState<Pick<JobSummary, 'id' | 'name'> | null>(null);
  const [sessionResults, setSessionResults] = useState<JobResult[]>([]);
  const [focusedResultPath, setFocusedResultPath] = useState<string | null>(null);

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

  const modelSourceConfig = useMemo(
    () => buildModelSourceConfig(selectedModelSource, checkpointPath),
    [selectedModelSource, checkpointPath]
  );
  const modelShapeServices = useMemo(
    () => services.filter(service => serviceMatchesModelShape(service, { selectedModelSource, checkpointPath })),
    [services, selectedModelSource, checkpointPath]
  );
  const configuredModelServices = useMemo(
    () => modelShapeServices.filter(service => service.gpu_ids.trim() === gpuIds.trim()),
    [modelShapeServices, gpuIds]
  );
  const runningModelService = configuredModelServices.find(service => service.status === 'running') ?? null;
  const controlledModelService =
    runningModelService ??
    configuredModelServices.find(service => ['queued', 'starting', 'stopping'].includes(service.status)) ??
    configuredModelServices[0] ??
    null;
  const modelStatus = controlledModelService?.status || 'not_loaded';
  const modelIsRunning = modelStatus === 'running';
  const modelIsTransitioning = ['queued', 'starting', 'stopping'].includes(modelStatus);
  const activeInferenceId = activeInference?.id || '';
  const { job: activeInferenceJob } = useJob(activeInferenceId, activeInference ? 1500 : null);
  const activeJobIsOpen =
    Boolean(activeInference) && !['completed', 'error', 'stopped'].includes(activeInferenceJob?.status || '');
  const { results: activeJobResults } = useJobResults(activeInferenceId, activeInference && (activeJobIsOpen || !activeInferenceJob) ? 1500 : null);
  const prompt = useMemo(() => buildInferencePrompt(promptSelection), [promptSelection]);
  const selectedPromptOptions = useMemo(() => getSelectedInferencePromptOptions(promptSelection), [promptSelection]);
  const outputResults = useMemo(
    () => mergeResults(activeJobResults, sessionResults, recentResults),
    [activeJobResults, sessionResults, recentResults],
  );

  useEffect(() => {
    if (!activeJobResults.length) return;
    const primaryResult = activeJobResults[0];
    setSessionResults(prev => mergeResults(activeJobResults, prev));
    setFocusedResultPath(primaryResult.image_path);
    void refreshRecentResults();
  }, [activeJobResults]);

  useEffect(() => {
    if (!activeInference || activeJobIsOpen || !activeJobResults.length) return;
    const timeout = window.setTimeout(() => setActiveInference(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [activeInference, activeJobIsOpen, activeJobResults.length]);

  useEffect(() => {
    const storedGpuIds = window.localStorage.getItem(GPU_IDS_STORAGE_KEY);
    if (storedGpuIds) {
      setGpuIds(storedGpuIds);
    }
    setGpuIdsRestored(true);
  }, []);

  useEffect(() => {
    if (!gpuIdsRestored || userChangedGpuIds) return;
    const loadedService =
      modelShapeServices.find(service => service.status === 'running') ??
      modelShapeServices.find(service => ['queued', 'starting', 'stopping'].includes(service.status));
    if (loadedService && loadedService.gpu_ids.trim() !== gpuIds.trim()) {
      setGpuIds(loadedService.gpu_ids);
      return;
    }
    if (!gpuIds && gpuList[0]) {
      setGpuIds(String(gpuList[0].index));
    }
  }, [gpuIdsRestored, gpuIds, gpuList, modelShapeServices, userChangedGpuIds]);

  useEffect(() => {
    if (!gpuIdsRestored || !gpuIds.trim()) return;
    window.localStorage.setItem(GPU_IDS_STORAGE_KEY, gpuIds);
  }, [gpuIds, gpuIdsRestored]);

  useEffect(() => {
    const trainJobId = new URLSearchParams(window.location.search).get('trainJobId');
    if (trainJobId) {
      setSourceTrainJobId(trainJobId);
    }
  }, []);

  const loadModel = async () => {
    if (modelAction || modelIsRunning || modelIsTransitioning) return;
    setModelAction('load');
    try {
      let service = controlledModelService;
      if (!service) {
        const response = await apiClient.post('/api/services', {
          name: `infer_service_${Date.now()}`,
          config: {
            gpu_ids: gpuIds,
            ...modelSourceConfig,
          },
        });
        service = response.data;
      }
      await apiClient.post(`/api/services/${service.id}/start`);
      pushToast({ title: t('loadModel'), description: service.name, tone: 'info' });
      await refreshServices();
    } finally {
      setModelAction(null);
    }
  };

  const unloadModel = async () => {
    if (modelAction || !controlledModelService || ['not_loaded', 'draft', 'stopped', 'stopping', 'error'].includes(modelStatus)) return;
    setModelAction('unload');
    try {
      await apiClient.post(`/api/services/${controlledModelService.id}/stop`);
      pushToast({ title: t('unloadModel'), description: controlledModelService.name, tone: 'warning' });
      await refreshServices();
    } finally {
      setModelAction(null);
    }
  };

  const runInference = async () => {
    if (isSubmittingInference) return;
    if (!runningModelService) {
      pushToast({ title: t('modelRequired'), description: t('modelRequiredDetail'), tone: 'warning' });
      return;
    }
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
          ...modelSourceConfig,
          preferred_service_id: runningModelService.id,
        },
      });
      const created = response.data;
      setActiveInference({ id: created.id, name: created.name });
      setFocusedResultPath(null);
      await apiClient.post(`/api/jobs/${created.id}/start`);
      setHistory(prev => [{ id: created.id, name: created.name, info: t('queued') }, ...prev]);
      pushToast({ title: t('queued'), description: created.name, tone: 'info' });
      refreshRecentResults();
    } catch (error) {
      setActiveInference(null);
      throw error;
    } finally {
      setIsSubmittingInference(false);
    }
  };

  const applyResultToForm = (item: JobResult) => {
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
    if (!runningModelService) {
      pushToast({ title: t('modelRequired'), description: t('modelRequiredDetail'), tone: 'warning' });
      return;
    }
    setIsSubmittingReplay(true);
    try {
      const replayName = `infer_${Date.now()}`;
      const response = await apiClient.post('/api/jobs', {
        name: replayName,
        job_type: 'infer',
        config: {
          prompt,
          seed: item.seed,
          num_inference_steps: item.num_inference_steps,
          output_prefix: outputPrefix,
          gpu_ids: item.gpu_ids || gpuIds,
          checkpoint_path: item.checkpoint_path,
          base_model: item.base_model || DEFAULT_INFERENCE_BASE_MODEL,
          use_lora: item.use_lora,
          source_train_job_id: item.source_train_job_id ?? null,
          preferred_service_id: runningModelService.id,
        },
      });
      const created = response.data;
      setActiveInference({ id: created.id, name: created.name });
      setFocusedResultPath(null);
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
    setSessionResults(prev => prev.filter(result => result.job_id !== item.job_id));
    if (focusedResultPath === item.image_path) {
      setFocusedResultPath(null);
    }
    refreshRecentResults();
  };

  const selectPromptOption = (groupId: InferencePromptGroupId, optionId: string) => {
    setPromptSelection(prev => normalizeInferencePromptSelection({ ...prev, [groupId]: optionId }));
  };

  return (
    <>
      <TopBar>
        <h1 className="text-base sm:text-lg">{t('title')}</h1>
      </TopBar>
      <MainContent className="pb-6">
        <div className="mx-auto max-w-[1680px] space-y-3">
          <section data-layout-area="quick-settings" className="rounded-lg border border-gray-800 bg-gray-900 p-3">
            <div className="grid gap-3 xl:grid-cols-[minmax(240px,0.9fr)_minmax(280px,1.25fr)_minmax(96px,0.32fr)_minmax(170px,auto)_auto_auto_auto] xl:items-end">
              <ModelSourceSelect
                label={t('modelSource')}
                options={modelSourceOptions}
                value={selectedModelSource}
                onChange={selectModelSource}
                kindLabels={{ base: t('baseModelTag'), lora: t('loraTag') }}
              />
              <Field label={t('checkpointPath')} value={checkpointPath} onChange={setCheckpointPath} compact />
              <Field
                label={t('gpuId')}
                value={gpuIds}
                onChange={value => {
                  setUserChangedGpuIds(true);
                  setGpuIds(value);
                }}
                compact
              />
              <ModelStatusIndicator status={modelStatus} service={controlledModelService} busy={Boolean(modelAction) || modelIsTransitioning} t={t} />
              <button
                type="button"
                onClick={() => void loadModel()}
                disabled={Boolean(modelAction) || modelIsRunning || modelIsTransitioning || !gpuIds.trim()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-800 bg-[#0969da] px-3 text-sm font-medium text-white transition hover:bg-[#0550ae] disabled:cursor-not-allowed disabled:border-gray-800 disabled:bg-gray-950 disabled:text-gray-500 dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-gray-950"
              >
                {modelAction === 'load' || ['queued', 'starting'].includes(modelStatus) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Power className="h-4 w-4" />
                )}
                {modelAction === 'load' || ['queued', 'starting'].includes(modelStatus) ? t('loadingModel') : t('loadModel')}
              </button>
              <button
                type="button"
                onClick={() => void unloadModel()}
                disabled={Boolean(modelAction) || !controlledModelService || ['not_loaded', 'draft', 'stopped', 'stopping', 'error'].includes(modelStatus)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-800 bg-gray-950 px-3 text-sm font-medium text-gray-500 transition hover:border-gray-700 hover:bg-gray-900 hover:text-gray-300 disabled:cursor-not-allowed disabled:text-gray-600"
              >
                {modelAction === 'unload' || modelStatus === 'stopping' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PowerOff className="h-4 w-4" />
                )}
                {modelAction === 'unload' || modelStatus === 'stopping' ? t('unloadingModel') : t('unloadModel')}
              </button>
              <button
                type="button"
                onClick={refreshRecentResults}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-800 bg-gray-950 px-3 text-sm font-medium text-gray-500 transition hover:border-gray-700 hover:bg-gray-900 hover:text-gray-300"
              >
                <RefreshCw className="h-4 w-4" />
                {t('refreshOutput')}
              </button>
            </div>
          </section>

          <section data-layout-area="prompt" className="rounded-lg border border-gray-800 bg-gray-900 p-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
              <PromptPreview label={t('prompt')} prompt={prompt} selectedOptions={selectedPromptOptions} />
              <button
                type="button"
                onClick={runInference}
                disabled={isSubmittingInference || !modelIsRunning}
                className="flex min-h-24 w-full items-center justify-center gap-3 rounded-md bg-[#0969da] px-6 py-5 text-base font-semibold text-white shadow-sm transition hover:bg-[#0550ae] disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500 dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-blue-900/40 dark:disabled:text-blue-200/60"
              >
                {isSubmittingInference ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    {t('submitting')}
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 fill-current" />
                    {modelIsRunning ? t('runInference') : t('modelRequired')}
                  </>
                )}
              </button>
            </div>
          </section>

          <div data-layout-area="txt2img-workspace" className="grid items-start gap-4 xl:grid-cols-[minmax(420px,0.96fr)_minmax(460px,1.04fr)]">
            <div data-panel-role="infer-left" className="min-w-0 space-y-4">
              <section data-layout-area="generation-settings" className="rounded-lg border border-gray-800 bg-gray-900 p-4">
                <SectionTitle icon={<SlidersHorizontal className="h-4 w-4" />} title={t('generationSettings')} />
                <PromptTagBuilder
                  title={t('promptBuilder')}
                  requiredLabel={t('requiredTag')}
                  groups={INFERENCE_PROMPT_GROUPS}
                  selection={promptSelection}
                  getOptions={getPromptGroupOptions}
                  groupTitle={group => t(group.titleKey)}
                  onSelect={selectPromptOption}
                />
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <RangeNumberField label={t('steps')} value={steps} min={1} max={80} onChange={setSteps} />
                  <NumberField label={t('seed')} value={seed} onChange={setSeed} />
                  <Field label={t('outputPrefix')} value={outputPrefix} onChange={setOutputPrefix} />
                  <Field label={t('jobName')} value={name} onChange={setName} className="md:col-span-2" />
                </div>
              </section>
            </div>

            <InferenceOutputPanel
              results={outputResults}
              history={history}
              favoriteImagePaths={favoriteImagePaths}
              isSubmittingReplay={isSubmittingReplay}
              activeRequest={
                activeInference
                  ? {
                      id: activeInference.id,
                      name: activeInference.name,
                      status: activeInferenceJob?.status,
                      info: activeInferenceJob?.info,
                    }
                  : null
              }
              activeHasResult={activeJobResults.length > 0}
              focusImagePath={focusedResultPath}
              onRefresh={refreshRecentResults}
              onToggleFavorite={toggleFavorite}
              onReuse={applyResultToForm}
              onReplay={replayResult}
              onDelete={deleteResultJob}
            />
          </div>
        </div>
      </MainContent>
    </>
  );
}

function mergeResults(...groups: JobResult[][]) {
  const seen = new Set<string>();
  const merged: JobResult[] = [];
  for (const group of groups) {
    for (const item of group) {
      if (seen.has(item.image_path)) continue;
      seen.add(item.image_path);
      merged.push(item);
    }
  }
  return merged;
}

function ModelStatusIndicator({
  status,
  service,
  busy,
  t,
}: {
  status: string;
  service: InferenceServiceSummary | null;
  busy: boolean;
  t: ReturnType<typeof useTranslations<'inferencePage'>>;
}) {
  const dotClass =
    status === 'running'
      ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]'
      : status === 'error'
        ? 'bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.12)]'
        : ['queued', 'starting', 'stopping'].includes(status)
          ? 'bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.14)]'
          : 'bg-gray-500 shadow-[0_0_0_4px_rgba(107,114,128,0.12)]';
  return (
    <div className="min-w-0 rounded-md border border-gray-800 bg-gray-950 px-3 py-2">
      <div className="mb-1 text-xs font-medium text-gray-500">{t('modelRuntime')}</div>
      <div className="flex min-w-0 items-center gap-2">
        {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-500" /> : <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-300">{modelStatusLabel(status, t)}</div>
          <div className="truncate text-xs text-gray-500">{service ? `GPU ${service.gpu_ids} · ${service.name}` : t('modelNoService')}</div>
        </div>
      </div>
    </div>
  );
}

function modelStatusLabel(status: string, t: ReturnType<typeof useTranslations<'inferencePage'>>) {
  if (status === 'running') return t('modelRunning');
  if (status === 'queued') return t('modelQueued');
  if (status === 'starting') return t('modelStarting');
  if (status === 'stopping') return t('modelStopping');
  if (status === 'stopped') return t('modelStopped');
  if (status === 'draft') return t('modelDraft');
  if (status === 'error') return t('modelError');
  return t('modelNotLoaded');
}

function serviceMatchesModelShape(
  service: InferenceServiceSummary,
  config: {
    selectedModelSource: { kind: string; sourceTrainJobId: string | null; baseModel: string };
    checkpointPath: string;
  },
) {
  if (service.base_model.trim() !== config.selectedModelSource.baseModel.trim()) return false;
  if (Boolean(service.use_lora) !== (config.selectedModelSource.kind === 'lora')) return false;
  if (config.selectedModelSource.kind !== 'lora') return true;

  const selectedSourceTrainJobId = config.selectedModelSource.sourceTrainJobId?.trim() || null;
  const serviceSourceTrainJobId = service.source_train_job_id?.trim() || null;
  if (selectedSourceTrainJobId && selectedSourceTrainJobId === serviceSourceTrainJobId) return true;
  return service.checkpoint_path.trim() === config.checkpointPath.trim();
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-800 bg-gray-900 text-gray-500">
        {icon}
      </span>
      {title}
    </div>
  );
}

function PromptPreview({
  label,
  prompt,
  selectedOptions,
}: {
  label: string;
  prompt: string;
  selectedOptions: InferencePromptOption[];
}) {
  return (
    <div className="block">
      <div className="mb-2 text-sm font-medium text-gray-300">{label}</div>
      <div className="min-h-28 rounded-lg border border-gray-800 bg-gray-950 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map(option => (
            <span key={option.id} className="rounded-md border border-gray-700 bg-gray-900 px-2.5 py-1 text-xs font-medium text-gray-500">
              {option.label}
            </span>
          ))}
        </div>
        <div className="mt-3 text-base leading-7 text-gray-300">{prompt}</div>
      </div>
    </div>
  );
}

function PromptTagBuilder({
  title,
  requiredLabel,
  groups,
  selection,
  getOptions,
  groupTitle,
  onSelect,
}: {
  title: string;
  requiredLabel: string;
  groups: InferencePromptGroup[];
  selection: InferencePromptSelection;
  getOptions: (groupId: InferencePromptGroupId, selection: InferencePromptSelection) => InferencePromptOption[];
  groupTitle: (group: InferencePromptGroup) => string;
  onSelect: (groupId: InferencePromptGroupId, optionId: string) => void;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-800 bg-gray-900 text-gray-500">
          <Tags className="h-4 w-4" />
        </span>
        {title}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {groups.map(group => {
          const options = getOptions(group.id, selection);
          return (
            <div key={group.id} className="rounded-lg border border-gray-800 bg-gray-950/70 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-gray-300">{groupTitle(group)}</div>
                {group.required ? (
                  <span className="shrink-0 rounded-md border border-[#0969da]/30 bg-[#0969da]/10 px-2 py-0.5 text-xs font-medium text-[#0969da] dark:border-blue-400/30 dark:bg-blue-500/10 dark:text-blue-300">
                    {requiredLabel}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {options.map(option => {
                  const selected = selection[group.id] === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onSelect(group.id, option.id)}
                      className={`min-h-9 rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                        selected
                          ? 'border-[#0969da] bg-[#0969da] text-white shadow-sm dark:border-blue-500 dark:bg-blue-600'
                          : 'border-gray-800 bg-gray-900 text-gray-500 hover:border-gray-700 hover:text-gray-300'
                      }`}
                      aria-pressed={selected}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  className = '',
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-2 text-sm font-medium text-gray-300">{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} className={`w-full rounded-lg border border-gray-800 bg-gray-950 text-gray-300 outline-none focus:border-gray-600 dark:focus:border-blue-500 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`} />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-gray-300">{label}</div>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} className="w-full rounded-lg border border-gray-800 bg-gray-950 px-4 py-3 text-gray-300 outline-none focus:border-gray-600 dark:focus:border-blue-500" />
    </label>
  );
}

function RangeNumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-300">{label}</span>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={event => onChange(Number(event.target.value))}
          className="h-9 w-24 rounded-lg border border-gray-800 bg-gray-950 px-3 text-right text-sm text-gray-300 outline-none focus:border-gray-600 dark:focus:border-blue-500"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        className="h-2 w-full accent-[#0969da] dark:accent-blue-500"
      />
    </label>
  );
}
