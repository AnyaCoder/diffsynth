'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import ConfirmDialog from '@/components/ConfirmDialog';
import ModelSourceSelect from '@/components/ModelSourceSelect';
import { useToast } from '@/components/ToastProvider';
import { MainContent, TopBar } from '@/components/layout';
import { DEFAULT_INFERENCE_OFFLOAD_MODE, normalizeInferenceOffloadMode } from '@/domain/inferenceRuntime';
import { buildModelSourceConfig } from '@/domain/modelSource';
import useGPUInfo from '@/hooks/useGPUInfo';
import useInferenceServices from '@/hooks/useInferenceServices';
import useJobsList from '@/hooks/useJobsList';
import useModelSourceSelection from '@/hooks/useModelSourceSelection';
import useServiceHealth from '@/hooks/useServiceHealth';
import useServiceLog from '@/hooks/useServiceLog';
import type { InferenceOffloadMode } from '@/types';
import { apiClient } from '@/utils/api';

export default function ServicesPage() {
  const t = useTranslations('servicesPage');
  const tCommon = useTranslations('common');
  const { pushToast } = useToast();
  const { gpuList } = useGPUInfo(null, 5000);
  const { jobs } = useJobsList({ jobType: 'train', reloadInterval: 5000 });
  const { services, refreshServices } = useInferenceServices(5000);

  const [name, setName] = useState(`service_${Date.now()}`);
  const [gpuIds, setGpuIds] = useState('');
  const [offloadMode, setOffloadMode] = useState<InferenceOffloadMode>(DEFAULT_INFERENCE_OFFLOAD_MODE);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const {
    checkpointPath,
    modelSourceOptions,
    selectedModelSource,
    selectModelSource,
    setCheckpointPath,
  } = useModelSourceSelection({
    jobs,
    baseLabel: t('baseModelOnly'),
  });
  const selectedService = services.find(service => service.id === selectedServiceId) ?? services[0] ?? null;
  const { health, refreshHealth } = useServiceHealth(selectedService?.id || '', selectedService ? 4000 : null);
  const { log, refresh: refreshLog } = useServiceLog(selectedService?.id || '', selectedService ? 2500 : null);

  useEffect(() => {
    if (!gpuIds && gpuList[0]) {
      setGpuIds(String(gpuList[0].index));
    }
  }, [gpuIds, gpuList]);

  useEffect(() => {
    if (!selectedServiceId && services[0]) {
      setSelectedServiceId(services[0].id);
      return;
    }
    if (selectedServiceId && !services.some(service => service.id === selectedServiceId)) {
      setSelectedServiceId(services[0]?.id || '');
    }
  }, [selectedServiceId, services]);

  const createService = async () => {
    setBusyAction('create');
    try {
      const response = await apiClient.post('/api/services', {
        name,
        config: {
          gpu_ids: gpuIds,
          offload_mode: offloadMode,
          ...buildModelSourceConfig(selectedModelSource, checkpointPath),
        },
      });
      pushToast({ title: t('createService'), description: name, tone: 'success' });
      setName(`service_${Date.now()}`);
      await refreshServices();
      setSelectedServiceId(response.data.id);
    } finally {
      setBusyAction(null);
    }
  };

  const startService = async (id: string) => {
    setBusyAction(`start:${id}`);
    try {
      await apiClient.post(`/api/services/${id}/start`);
      pushToast({ title: t('start'), description: services.find(service => service.id === id)?.name || id, tone: 'info' });
      await refreshServices();
      if (selectedService?.id === id) {
        await refreshHealth();
        await refreshLog(true);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const stopService = async (id: string) => {
    setBusyAction(`stop:${id}`);
    try {
      await apiClient.post(`/api/services/${id}/stop`);
      pushToast({ title: t('stop'), description: services.find(service => service.id === id)?.name || id, tone: 'warning' });
      await refreshServices();
    } finally {
      setBusyAction(null);
    }
  };

  const deleteService = async (id: string) => {
    setBusyAction(`delete:${id}`);
    try {
      await apiClient.delete(`/api/services/${id}`);
      pushToast({ title: tCommon('delete'), description: services.find(service => service.id === id)?.name || id, tone: 'warning' });
      if (selectedServiceId === id) {
        const remaining = services.filter(service => service.id !== id);
        setSelectedServiceId(remaining[0]?.id || '');
      }
      setPendingDeleteId(null);
      await refreshServices();
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <>
      <TopBar>
        <h1 className="text-base sm:text-lg">{t('title')}</h1>
      </TopBar>
      <MainContent className="space-y-6">
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t('createService')}</h2>
            <button onClick={() => void refreshServices()} className="text-sm text-blue-400">{tCommon('refresh')}</button>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Field label={t('serviceName')} value={name} onChange={setName} />
            <Field label={t('gpuIds')} value={gpuIds} onChange={setGpuIds} />
            <SelectField
              label={t('offloadMode')}
              value={offloadMode}
              onChange={value => setOffloadMode(normalizeInferenceOffloadMode(value))}
              options={[
                { value: 'disk_cpu', label: t('offloadModeDiskCpu') },
                { value: 'none', label: t('offloadModeNone') },
              ]}
            />
            <div className="xl:col-span-2">
              <ModelSourceSelect
                label={t('modelSource')}
                options={modelSourceOptions}
                value={selectedModelSource}
                onChange={selectModelSource}
                kindLabels={{ base: t('baseTag'), lora: t('loraTag') }}
              />
            </div>
            <div className="xl:col-span-2">
              <Field label={t('checkpointPath')} value={checkpointPath} onChange={setCheckpointPath} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => void createService()}
              disabled={busyAction === 'create'}
              className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {busyAction === 'create' ? tCommon('working') : t('createService')}
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-gray-800 bg-gray-900">
            <div className="border-b border-gray-800 px-5 py-4">
              <h2 className="text-lg font-semibold">{t('serviceList')}</h2>
            </div>
            <div className="divide-y divide-gray-800">
              {services.map(service => {
                const active = selectedService?.id === service.id;
                const runningLike = ['starting', 'running', 'stopping'].includes(service.status);
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => setSelectedServiceId(service.id)}
                    className={`w-full px-5 py-4 text-left transition ${active ? 'bg-gray-950/70' : 'hover:bg-gray-950/40'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-100">{service.name}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          GPU {service.gpu_ids} · {service.use_lora ? t('loraEnabled') : t('baseOnly')} · {offloadModeLabel(normalizeInferenceOffloadMode(service.offload_mode), t)}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">{service.info}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`inline-flex rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${serviceStatusBadgeClass(service.status)}`}>
                          {t(`statusLabel.${service.status}`)}
                        </div>
                        <div className="mt-3 flex justify-end gap-2">
                          {!runningLike ? (
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                void startService(service.id);
                              }}
                              className="rounded-md border border-emerald-800 px-2.5 py-1.5 text-xs text-emerald-300 hover:bg-emerald-950/40"
                            >
                              {busyAction === `start:${service.id}` ? tCommon('working') : t('start')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                void stopService(service.id);
                              }}
                              className="rounded-md border border-orange-800 px-2.5 py-1.5 text-xs text-orange-300 hover:bg-orange-950/40"
                            >
                              {busyAction === `stop:${service.id}` ? tCommon('working') : t('stop')}
                            </button>
                          )}
                          {!runningLike ? (
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                setPendingDeleteId(service.id);
                              }}
                              className="rounded-md border border-red-900 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-950/40"
                            >
                              {tCommon('delete')}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {services.length === 0 ? <div className="px-5 py-8 text-sm text-gray-500">{t('noServices')}</div> : null}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{t('health')}</h2>
                {selectedService ? <button onClick={() => void refreshHealth()} className="text-sm text-blue-400">{tCommon('refresh')}</button> : null}
              </div>
              {!selectedService ? (
                <div className="mt-4 text-sm text-gray-500">{t('selectAService')}</div>
              ) : (
                <div className="mt-4 space-y-3 text-sm text-gray-300">
                  <InfoRow label={t('endpoint')} value={health?.endpoint_url || selectedService.endpoint_url || '-'} mono />
                  <InfoRow label={t('port')} value={String(health?.port ?? selectedService.port ?? '-')} />
                  <InfoRow label={t('healthStatus')} value={health?.reachable ? t('reachable') : health?.error || t('unreachable')} />
                  <InfoRow label={t('modelMode')} value={selectedService.use_lora ? t('loraEnabled') : t('baseOnly')} />
                  <InfoRow label={t('offloadMode')} value={offloadModeLabel(normalizeInferenceOffloadMode(selectedService.offload_mode), t)} />
                </div>
              )}
            </section>

            <section className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">{t('log')}</h2>
                {selectedService ? <button onClick={() => void refreshLog(true)} className="text-sm text-blue-400">{tCommon('refresh')}</button> : null}
              </div>
              <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg border border-gray-800 bg-gray-950 p-4 text-xs text-gray-300">
                {selectedService ? log || t('waitingForLog') : t('selectAService')}
              </pre>
            </section>
          </div>
        </section>
      </MainContent>
      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title={t('deleteService')}
        message={
          pendingDeleteId
            ? t('deleteServiceMessage', {
                name: services.find(service => service.id === pendingDeleteId)?.name || pendingDeleteId,
              })
            : ''
        }
        confirmLabel={tCommon('delete')}
        cancelLabel={tCommon('cancel')}
        busyLabel={tCommon('working')}
        tone="danger"
        busy={pendingDeleteId ? busyAction === `delete:${pendingDeleteId}` : false}
        onCancel={() => {
          if (pendingDeleteId && busyAction === `delete:${pendingDeleteId}`) return;
          setPendingDeleteId(null);
        }}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          await deleteService(pendingDeleteId);
        }}
      />
    </>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-gray-300">{label}</div>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm text-gray-400">{label}</div>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-800 bg-gray-950 px-4 py-3 text-gray-100 outline-none focus:border-blue-500"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function offloadModeLabel(value: InferenceOffloadMode, t: ReturnType<typeof useTranslations<'servicesPage'>>) {
  return value === 'none' ? t('offloadModeNone') : t('offloadModeDiskCpu');
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-gray-500">{label}</div>
      <div className={`text-right ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
    </div>
  );
}

function serviceStatusBadgeClass(status: string) {
  if (status === 'running') return 'border border-emerald-900 bg-emerald-950/50 text-emerald-300';
  if (status === 'queued' || status === 'draft' || status === 'starting') return 'border border-amber-900 bg-amber-950/50 text-amber-300';
  if (status === 'stopping' || status === 'stopped') return 'border border-orange-900 bg-orange-950/50 text-orange-300';
  if (status === 'error') return 'border border-red-900 bg-red-950/50 text-red-300';
  return 'border border-gray-800 bg-gray-950 text-gray-400';
}
