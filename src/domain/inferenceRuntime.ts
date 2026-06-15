import type { InferenceOffloadMode } from '../types';

export const DEFAULT_INFERENCE_OFFLOAD_MODE: InferenceOffloadMode = 'disk_cpu';

export function normalizeInferenceOffloadMode(value: unknown): InferenceOffloadMode {
  return value === 'none' ? 'none' : DEFAULT_INFERENCE_OFFLOAD_MODE;
}

export function inferenceOffloadModeMatches(left: unknown, right: unknown) {
  return normalizeInferenceOffloadMode(left) === normalizeInferenceOffloadMode(right);
}
