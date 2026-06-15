export interface GpuUtilization {
  gpu: number;
  memory: number;
}

export interface GpuMemory {
  total: number;
  free: number;
  used: number;
}

export interface GpuPower {
  draw: number;
  limit: number;
}

export interface GpuClocks {
  graphics: number;
  memory: number;
}

export interface GpuFan {
  speed: number;
}

export interface GpuInfo {
  index: number;
  name: string;
  driverVersion: string;
  temperature: number;
  utilization: GpuUtilization;
  memory: GpuMemory;
  power: GpuPower;
  clocks: GpuClocks;
  fan: GpuFan;
}

export interface CpuInfo {
  name: string;
  cores: number;
  temperature: number;
  totalMemory: number;
  freeMemory: number;
  availableMemory: number;
  currentLoad: number;
}

export interface DiskInfo {
  datasetsRoot: string;
  trainingRoot: string;
  inferenceRoot: string;
  freeBytes: number;
  totalBytes: number;
}

export interface GPUApiResponse {
  hasNvidiaSmi: boolean;
  isMac: boolean;
  gpus: GpuInfo[];
  error?: string;
}

export interface DatasetItem {
  file_name: string;
  relative_path: string;
  caption: string;
  has_caption: boolean;
  thumb_url: string;
}

export interface TrainJobConfig {
  dataset_name: string;
  gpu_ids?: string;
  dataset_base_path: string;
  dataset_metadata_path: string;
  output_path: string;
  learning_rate: number;
  num_epochs: number;
  dataset_repeat: number;
  max_pixels: number;
  lora_rank: number;
  dataset_num_workers: number;
  gradient_accumulation_steps: number;
  use_gradient_checkpointing: boolean;
  find_unused_parameters: boolean;
  multi_gpu?: boolean;
  model_id_with_origin_paths: string;
  fp8_models: string;
  lora_base_model: string;
  lora_target_modules: string;
  remove_prefix_in_ckpt: string;
  resolved_command?: string;
  resolved_command_argv?: string[];
  resolved_command_env?: Record<string, string>;
  resolved_num_processes?: number;
}

export type InferenceOffloadMode = 'disk_cpu' | 'none';

export interface InferJobConfig {
  prompt: string;
  seed: number;
  num_inference_steps: number;
  output_prefix: string;
  gpu_ids: string;
  offload_mode?: InferenceOffloadMode;
  checkpoint_path: string;
  base_model: string;
  use_lora?: boolean;
  source_train_job_id?: string | null;
  preferred_service_id?: string | null;
}

export interface JobSummary {
  id: string;
  name: string;
  job_type: 'train' | 'infer';
  status: string;
  is_archived?: boolean;
  gpu_ids: string;
  progress_current: number;
  progress_total: number;
  info: string;
  artifact_root: string;
  created_at: string;
  updated_at: string;
  finished_at?: string | null;
  pid?: number | null;
  stop_requested?: boolean;
  config_json: string;
  queue_position: number;
}

export interface JobArtifact {
  kind: 'checkpoint' | 'image' | 'log' | 'spec';
  name: string;
  path: string;
  size: number;
  created_at: string;
}

export interface JobResult {
  image_path: string;
  image_url: string;
  prompt: string;
  seed: number;
  num_inference_steps: number;
  checkpoint_path: string;
  created_at: string;
  source_train_job_id?: string | null;
  service_id?: string | null;
  served_by?: 'service' | 'ephemeral';
  base_model?: string;
  use_lora?: boolean;
  job_id?: string;
  job_name?: string;
  job_status?: string;
  gpu_ids?: string;
  offload_mode?: InferenceOffloadMode;
  step?: number | null;
  epoch?: number | null;
}

export interface QueueInfo {
  id: number;
  gpu_ids: string;
  is_running: boolean;
}

export interface SettingsPayload {
  DATASETS_ROOT: string;
  TRAINING_ROOT: string;
  INFERENCE_ROOT: string;
  CONDA_ENV_NAME: string;
}

export interface InferenceServiceSummary {
  id: string;
  name: string;
  status: string;
  gpu_ids: string;
  offload_mode: InferenceOffloadMode;
  pid?: number | null;
  stop_requested?: boolean;
  base_model: string;
  checkpoint_path: string;
  use_lora: boolean;
  source_train_job_id?: string | null;
  artifact_root: string;
  endpoint_url?: string | null;
  port?: number | null;
  info: string;
  created_at: string;
  updated_at: string;
  finished_at?: string | null;
}
