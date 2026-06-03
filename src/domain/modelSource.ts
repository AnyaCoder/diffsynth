import { InferenceServiceSummary, JobSummary } from '../types';
import { readTrainConfigFromJson } from './jobSpec';

export const DEFAULT_INFERENCE_BASE_MODEL = 'Qwen/Qwen-Image-2512';

export type ModelSourceKind = 'base' | 'lora';

export interface ModelSourceOption {
  id: string;
  label: string;
  checkpointPath: string;
  sourceTrainJobId: string | null;
  baseModel: string;
  kind: ModelSourceKind;
}

export function buildModelSourceOptions({
  jobs,
  baseLabel,
  baseModel = DEFAULT_INFERENCE_BASE_MODEL,
}: {
  jobs: Pick<JobSummary, 'id' | 'name' | 'job_type' | 'config_json' | 'artifact_root'>[];
  baseLabel: string;
  baseModel?: string;
}): ModelSourceOption[] {
  const baseOption: ModelSourceOption = {
    id: 'base-model',
    label: baseLabel,
    checkpointPath: '',
    sourceTrainJobId: null,
    baseModel,
    kind: 'base',
  };

  const loraOptions = jobs
    .filter(job => job.job_type === 'train')
    .map(job => {
      const config = readTrainConfigFromJson(job.config_json);
      return {
        id: job.id,
        label: job.name,
        checkpointPath: '',
        sourceTrainJobId: job.id,
        baseModel,
        kind: 'lora' as const,
      };
    });

  return [baseOption, ...loraOptions];
}

export function resolveSelectedModelSource(
  options: ModelSourceOption[],
  sourceTrainJobId: string | null | undefined,
) {
  return options.find(option => option.sourceTrainJobId === (sourceTrainJobId ?? null)) ?? options[0];
}

export function buildModelSourceConfig(
  selectedModelSource: ModelSourceOption,
  checkpointPath: string,
) {
  return {
    checkpoint_path: checkpointPath,
    base_model: selectedModelSource.baseModel,
    use_lora: selectedModelSource.kind === 'lora',
    source_train_job_id: selectedModelSource.sourceTrainJobId,
  };
}

export function matchesInferenceServiceForModelSource(
  service: InferenceServiceSummary,
  config: {
    gpuIds: string;
    selectedModelSource: ModelSourceOption;
    checkpointPath: string;
  },
) {
  if (service.status !== 'running') return false;
  if (service.gpu_ids.trim() !== config.gpuIds.trim()) return false;
  if (service.base_model.trim() !== config.selectedModelSource.baseModel.trim()) return false;
  if (Boolean(service.use_lora) !== (config.selectedModelSource.kind === 'lora')) return false;
  if (config.selectedModelSource.kind !== 'lora') return true;

  const selectedSourceTrainJobId = config.selectedModelSource.sourceTrainJobId?.trim() || null;
  const serviceSourceTrainJobId = service.source_train_job_id?.trim() || null;
  if (selectedSourceTrainJobId && selectedSourceTrainJobId === serviceSourceTrainJobId) {
    return true;
  }
  return service.checkpoint_path.trim() === config.checkpointPath.trim();
}
