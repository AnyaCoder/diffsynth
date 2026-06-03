import type { InferJobConfig, TrainJobConfig } from '../types';

export const JOB_SPEC_VERSION = 1;

export type JobSpec =
  | {
      spec_version: typeof JOB_SPEC_VERSION;
      job_type: 'train';
      config: TrainJobConfig;
    }
  | {
      spec_version: typeof JOB_SPEC_VERSION;
      job_type: 'infer';
      config: InferJobConfig;
    };

export function serializeJobSpec(spec: JobSpec) {
  return JSON.stringify(spec);
}

export function createTrainJobSpec(config: TrainJobConfig): JobSpec {
  return {
    spec_version: JOB_SPEC_VERSION,
    job_type: 'train',
    config,
  };
}

export function createInferJobSpec(config: InferJobConfig): JobSpec {
  return {
    spec_version: JOB_SPEC_VERSION,
    job_type: 'infer',
    config,
  };
}

export function parseJobSpec(json: string, fallbackJobType?: string): JobSpec {
  const parsed = JSON.parse(json);
  if (isVersionedJobSpec(parsed)) {
    return parsed;
  }
  if (fallbackJobType === 'infer') {
    return createInferJobSpec(parsed as InferJobConfig);
  }
  return createTrainJobSpec(parsed as TrainJobConfig);
}

export function readTrainConfigFromJson(json: string): TrainJobConfig {
  const spec = parseJobSpec(json, 'train');
  if (spec.job_type !== 'train') {
    throw new Error(`Expected train job spec, got ${spec.job_type}`);
  }
  return spec.config;
}

export function readInferConfigFromJson(json: string): InferJobConfig {
  const spec = parseJobSpec(json, 'infer');
  if (spec.job_type !== 'infer') {
    throw new Error(`Expected infer job spec, got ${spec.job_type}`);
  }
  return spec.config;
}

function isVersionedJobSpec(value: unknown): value is JobSpec {
  if (!value || typeof value !== 'object') return false;
  const maybeSpec = value as Partial<JobSpec>;
  return maybeSpec.spec_version === JOB_SPEC_VERSION && (maybeSpec.job_type === 'train' || maybeSpec.job_type === 'infer') && typeof maybeSpec.config === 'object';
}
