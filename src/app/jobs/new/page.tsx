'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import ResizableSplitPanel from '@/components/ResizableSplitPanel';
import { useToast } from '@/components/ToastProvider';
import { MainContent, TopBar } from '@/components/layout';
import useDatasetList from '@/hooks/useDatasetList';
import { apiClient } from '@/utils/api';
import useGPUInfo from '@/hooks/useGPUInfo';
import { buildTrainConfigPreview } from '@/utils/train';

const defaultConfig = {
  learning_rate: 1e-4,
  num_epochs: 5,
  dataset_repeat: 50,
  max_pixels: 1048576,
  lora_rank: 32,
  dataset_num_workers: 8,
  gradient_accumulation_steps: 1,
  use_gradient_checkpointing: true,
  find_unused_parameters: true,
  multi_gpu: false,
};

export default function NewTrainJobPage() {
  const t = useTranslations('trainForm');
  const { pushToast } = useToast();
  const { datasets } = useDatasetList();
  const { gpuList } = useGPUInfo(null, 5000);
  const [name, setName] = useState('');
  const [datasetName, setDatasetName] = useState('');
  const [gpuIds, setGpuIds] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [config, setConfig] = useState(defaultConfig);

  useEffect(() => {
    if (!datasetName && datasets[0]) setDatasetName(datasets[0]);
  }, [datasets, datasetName]);

  useEffect(() => {
    if (!gpuIds && gpuList[0]) setGpuIds(String(gpuList[0].index));
  }, [gpuList, gpuIds]);

  const preview = useMemo(() => buildTrainConfigPreview({ name, datasetName, outputPath, gpuIds, config }), [name, datasetName, outputPath, gpuIds, config]);

  const createJob = async () => {
    await apiClient.post('/api/jobs', {
      name,
      job_type: 'train',
      dataset_name: datasetName,
      gpu_ids: gpuIds,
      output_path: outputPath || undefined,
      config,
    });
    pushToast({ title: t('createTrainJob'), description: name || datasetName, tone: 'success' });
    window.location.href = '/jobs';
  };

  return (
    <>
      <TopBar>
        <h1 className="text-base sm:text-lg">{t('title')}</h1>
      </TopBar>
      <MainContent>
        <ResizableSplitPanel
          defaultLeftWidth={820}
          minLeftWidth={640}
          maxLeftWidth={980}
          left={
            <div data-panel-role="train-left" className="w-full rounded-xl border border-gray-800 bg-gray-900 p-5">
              <h2 className="text-lg font-semibold">{t('formTitle')}</h2>
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Input label={t('jobName')} value={name} onChange={setName} />
                <Select label={t('dataset')} value={datasetName} onChange={setDatasetName} options={datasets} selectLabel={t('select')} />
                <Input label={t('gpuIds')} value={gpuIds} onChange={setGpuIds} />
                <Input label={t('outputPath')} value={outputPath} onChange={setOutputPath} placeholder={t('outputPlaceholder')} />
                <NumberInput label={t('learningRate')} value={config.learning_rate} onChange={value => setConfig(prev => ({ ...prev, learning_rate: value }))} />
                <NumberInput label={t('epochs')} value={config.num_epochs} onChange={value => setConfig(prev => ({ ...prev, num_epochs: value }))} />
                <NumberInput label={t('datasetRepeat')} value={config.dataset_repeat} onChange={value => setConfig(prev => ({ ...prev, dataset_repeat: value }))} />
                <NumberInput label={t('maxPixels')} value={config.max_pixels} onChange={value => setConfig(prev => ({ ...prev, max_pixels: value }))} />
                <NumberInput label={t('loraRank')} value={config.lora_rank} onChange={value => setConfig(prev => ({ ...prev, lora_rank: value }))} />
                <NumberInput label={t('datasetWorkers')} value={config.dataset_num_workers} onChange={value => setConfig(prev => ({ ...prev, dataset_num_workers: value }))} />
                <NumberInput label={t('gradAccum')} value={config.gradient_accumulation_steps} onChange={value => setConfig(prev => ({ ...prev, gradient_accumulation_steps: value }))} />
                <div className="flex flex-wrap items-center gap-3 pt-2 md:col-span-2 md:pt-6">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.use_gradient_checkpointing} onChange={e => setConfig(prev => ({ ...prev, use_gradient_checkpointing: e.target.checked }))} /> {t('gradientCheckpointing')}</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.find_unused_parameters} onChange={e => setConfig(prev => ({ ...prev, find_unused_parameters: e.target.checked }))} /> {t('findUnusedParams')}</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.multi_gpu} onChange={e => setConfig(prev => ({ ...prev, multi_gpu: e.target.checked }))} /> {t('multiGpu')}</label>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500 xl:hidden">{t('dragHint')}</div>
              <button onClick={createJob} className="mt-6 rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-500">{t('createTrainJob')}</button>
            </div>
          }
          right={
            <div data-panel-role="train-right" className="w-full rounded-xl border border-gray-800 bg-gray-900 p-5">
            <h2 className="text-lg font-semibold">{t('commandPreview')}</h2>
            <pre className="mt-4 max-h-[calc(100vh-10rem)] overflow-auto whitespace-pre rounded-lg border border-gray-800 bg-gray-950 p-4 text-xs text-gray-300">{preview}</pre>
          </div>
          }
        />
      </MainContent>
    </>
  );
}

function Input({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-gray-300">{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500" />
    </label>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-gray-300">{label}</div>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500" />
    </label>
  );
}

function Select({ label, value, onChange, options, selectLabel }: { label: string; value: string; onChange: (value: string) => void; options: string[]; selectLabel: string }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-gray-300">{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500">
        <option value="">{selectLabel}</option>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}
