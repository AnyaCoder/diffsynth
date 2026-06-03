import type { TrainJobConfig } from '../types';

const MODEL_ID_WITH_ORIGIN_PATHS =
  'Qwen/Qwen-Image-2512:transformer/diffusion_pytorch_model*.safetensors,Qwen/Qwen-Image:text_encoder/model*.safetensors,Qwen/Qwen-Image:vae/diffusion_pytorch_model.safetensors';
const FP8_MODELS =
  'Qwen/Qwen-Image-2512:transformer/diffusion_pytorch_model*.safetensors,Qwen/Qwen-Image:text_encoder/model*.safetensors,Qwen/Qwen-Image:vae/diffusion_pytorch_model.safetensors';
const LORA_TARGET_MODULES =
  'to_q,to_k,to_v,add_q_proj,add_k_proj,add_v_proj,to_out.0,to_add_out,img_mlp.net.2,img_mod.1,txt_mlp.net.2,txt_mod.1';

type TrainFormConfig = Pick<
  TrainJobConfig,
  | 'learning_rate'
  | 'num_epochs'
  | 'dataset_repeat'
  | 'max_pixels'
  | 'lora_rank'
  | 'dataset_num_workers'
  | 'gradient_accumulation_steps'
  | 'use_gradient_checkpointing'
  | 'find_unused_parameters'
  | 'multi_gpu'
>;

export interface TrainCommandPlan {
  argv: string[];
  env: Record<string, string>;
  numProcesses: number;
  shellScript: string;
}

export function buildDefaultTrainConfig(params: {
  datasetName: string;
  datasetBasePath: string;
  datasetMetadataPath: string;
  outputPath: string;
}): TrainJobConfig {
  return {
    dataset_name: params.datasetName,
    dataset_base_path: params.datasetBasePath,
    dataset_metadata_path: params.datasetMetadataPath,
    output_path: params.outputPath,
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
    model_id_with_origin_paths: MODEL_ID_WITH_ORIGIN_PATHS,
    fp8_models: FP8_MODELS,
    lora_base_model: 'dit',
    lora_target_modules: LORA_TARGET_MODULES,
    remove_prefix_in_ckpt: 'pipe.dit.',
  };
}

export function resolveTrainCommandConfig(config: TrainJobConfig): TrainJobConfig {
  const plan = buildTrainCommandPlan(config);
  return {
    ...config,
    resolved_command: plan.shellScript,
    resolved_command_argv: plan.argv,
    resolved_command_env: plan.env,
    resolved_num_processes: plan.numProcesses,
  };
}

export function buildTrainCommand(config: TrainJobConfig) {
  return buildTrainCommandPlan(config).shellScript;
}

export function buildTrainCommandPlan(config: TrainJobConfig): TrainCommandPlan {
  const numProcesses = getTrainProcessCount(config);
  const argv = buildTrainCommandArgv(config, numProcesses);
  const env = buildTrainCommandEnv(config);
  return {
    argv,
    env,
    numProcesses,
    shellScript: formatShellScript(env, argv),
  };
}

export function getTrainProcessCount(config: Pick<TrainJobConfig, 'multi_gpu'> & { gpu_ids?: string }) {
  if (!config.multi_gpu) return 1;
  return Math.max(1, parseGpuIds(config.gpu_ids).length);
}

export function buildTrainConfigPreview({
  name,
  datasetName,
  outputPath,
  gpuIds,
  config,
}: {
  name: string;
  datasetName: string;
  outputPath: string;
  gpuIds: string;
  config: TrainFormConfig;
}) {
  const displayDataset = datasetName || '<dataset>';
  const displayName = name || '<job-name>';
  const resolvedOutputPath = outputPath || `./models/train/${displayName}`;
  const previewConfig: TrainJobConfig = {
    ...buildDefaultTrainConfig({
      datasetName: displayDataset,
      datasetBasePath: `<datasets_root>/${displayDataset}`,
      datasetMetadataPath: `<datasets_root>/${displayDataset}/metadata.csv`,
      outputPath: resolvedOutputPath,
    }),
    ...config,
    gpu_ids: gpuIds || '<gpu>',
  };

  return [
    `# name: ${displayName}`,
    `# dataset: ${displayDataset}`,
    `# gpu_ids: ${gpuIds || '<gpu>'}`,
    `# output_path: ${resolvedOutputPath}`,
    buildTrainCommand(previewConfig),
  ].join('\n');
}

function buildTrainCommandArgv(config: TrainJobConfig, numProcesses: number) {
  return [
    'accelerate',
    'launch',
    ...(config.multi_gpu ? ['--multi_gpu'] : []),
    '--num_processes',
    String(numProcesses),
    'examples/qwen_image/model_training/train.py',
    '--dataset_base_path',
    config.dataset_base_path,
    '--dataset_metadata_path',
    config.dataset_metadata_path,
    '--max_pixels',
    String(config.max_pixels),
    '--dataset_repeat',
    String(config.dataset_repeat),
    '--model_id_with_origin_paths',
    config.model_id_with_origin_paths,
    '--fp8_models',
    config.fp8_models,
    '--learning_rate',
    String(config.learning_rate),
    '--num_epochs',
    String(config.num_epochs),
    '--remove_prefix_in_ckpt',
    config.remove_prefix_in_ckpt,
    '--output_path',
    config.output_path,
    '--lora_base_model',
    config.lora_base_model,
    '--lora_target_modules',
    config.lora_target_modules,
    '--lora_rank',
    String(config.lora_rank),
    ...(config.use_gradient_checkpointing ? ['--use_gradient_checkpointing'] : []),
    '--dataset_num_workers',
    String(config.dataset_num_workers),
    '--gradient_accumulation_steps',
    String(config.gradient_accumulation_steps),
    ...(config.find_unused_parameters ? ['--find_unused_parameters'] : []),
  ];
}

function buildTrainCommandEnv(config: TrainJobConfig) {
  const env: Record<string, string> = {
    CUDA_DEVICE_ORDER: 'PCI_BUS_ID',
    DIFFSYNTH_ATTENTION_IMPLEMENTATION: 'flash_attention_2',
  };
  const gpuIds = normalizeGpuIds(config.gpu_ids);
  if (gpuIds) {
    env.CUDA_VISIBLE_DEVICES = gpuIds;
  }
  return env;
}

function parseGpuIds(gpuIds?: string) {
  return String(gpuIds || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
}

function normalizeGpuIds(gpuIds?: string) {
  return parseGpuIds(gpuIds).join(',');
}

function formatShellScript(env: Record<string, string>, argv: string[]) {
  const envLines = Object.entries(env).map(([key, value]) => `export ${key}=${shellToken(value)}`);
  return [...envLines, formatArgv(argv)].join('\n');
}

function formatArgv(argv: string[]) {
  const [command, subcommand, ...rest] = argv;
  const lines = [`${shellToken(command)} ${shellToken(subcommand)} \\`];
  rest.forEach((part, index) => {
    const suffix = index === rest.length - 1 ? '' : ' \\';
    lines.push(`  ${shellToken(part)}${suffix}`);
  });
  return lines.join('\n');
}

function shellToken(input: string) {
  if (/^[A-Za-z0-9_./:=,@+-]+$/.test(input)) return input;
  return `"${input.replace(/(["\\$`])/g, '\\$1')}"`;
}
