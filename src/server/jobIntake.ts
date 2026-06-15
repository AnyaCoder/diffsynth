import prisma from './prisma';
import fs from 'fs';
import path from 'path';
import {
  buildDefaultTrainConfig,
  defaultInferOutputPath,
  defaultTrainOutputPath,
  ensureQueue,
  resolveInferenceConfig,
  resolveTrainCommandConfig,
} from './jobs';
import { getDatasetPath, rebuildMetadataCsv } from './datasets';
import { isGpuBusy } from './process';
import { REPO_ROOT } from './paths';
import { createInferJobSpec, createTrainJobSpec, serializeJobSpec } from '../domain/jobSpec';

export class JobIntakeError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export async function createJobFromRequest(body: any) {
  const name = String(body.name || '').trim();

  if (!name) {
    throw new JobIntakeError('Job name is required');
  }

  if (body.job_type === 'train') {
    return createTrainJob(name, body);
  }

  if (body.job_type === 'infer') {
    return createInferJob(name, body);
  }

  throw new JobIntakeError('Unsupported job type');
}

async function createTrainJob(name: string, body: any) {
  const datasetName = String(body.dataset_name || '').trim();
  const gpuIds = String(body.gpu_ids || '').trim();
  const requestedConfig = body.config ?? {};
  if (!datasetName) {
    throw new JobIntakeError('Dataset name is required');
  }
  if (!gpuIds) {
    throw new JobIntakeError('GPU IDs are required');
  }

  const datasetBasePath = await resolveTrainDatasetBasePath(datasetName, requestedConfig);
  const datasetMetadataPath = await resolveTrainDatasetMetadataPath(datasetName, datasetBasePath, requestedConfig);
  const outputPath = await resolveTrainOutputPath(name, body.output_path);
  const defaultConfig = buildDefaultTrainConfig({
    datasetName,
    datasetBasePath,
    datasetMetadataPath,
    outputPath,
  });
  const resolvedConfig = resolveTrainCommandConfig({
    ...defaultConfig,
    ...requestedConfig,
    dataset_name: datasetName,
    gpu_ids: gpuIds,
    dataset_base_path: datasetBasePath,
    dataset_metadata_path: datasetMetadataPath,
    output_path: outputPath,
  });
  const highest = await prisma.job.aggregate({ _max: { queue_position: true } });
  await ensureQueue(gpuIds);

  return prisma.job.create({
    data: {
      name,
      job_type: 'train',
      status: 'draft',
      gpu_ids: gpuIds,
      queue_position: (highest._max.queue_position || 0) + 1000,
      artifact_root: outputPath,
      config_json: serializeJobSpec(createTrainJobSpec(resolvedConfig)),
      info: 'Draft training job',
    },
  });
}

async function resolveTrainDatasetBasePath(datasetName: string, config: any) {
  const explicitPath = String(config.dataset_base_path || '').trim();
  if (explicitPath) {
    const resolved = resolveRepoRelativePath(explicitPath);
    if (!fs.existsSync(resolved)) {
      throw new JobIntakeError(`Dataset path not found: ${resolved}`, 400);
    }
    return resolved;
  }
  return getDatasetPath(datasetName);
}

async function resolveTrainDatasetMetadataPath(datasetName: string, datasetBasePath: string, config: any) {
  const explicitPath = String(config.dataset_metadata_path || '').trim();
  if (explicitPath) {
    const resolved = resolveRepoRelativePath(explicitPath);
    if (!fs.existsSync(resolved)) {
      throw new JobIntakeError(`Dataset metadata not found: ${resolved}`, 400);
    }
    return resolved;
  }
  if (String(config.dataset_base_path || '').trim()) {
    const metadataPath = path.join(datasetBasePath, 'metadata.csv');
    if (!fs.existsSync(metadataPath)) {
      throw new JobIntakeError(`Dataset metadata not found: ${metadataPath}`, 400);
    }
    return metadataPath;
  }
  return rebuildMetadataCsv(datasetName);
}

async function resolveTrainOutputPath(name: string, outputPath: unknown) {
  const explicitPath = String(outputPath || '').trim();
  if (explicitPath) {
    return resolveRepoRelativePath(explicitPath);
  }
  return defaultTrainOutputPath(name);
}

function resolveRepoRelativePath(inputPath: string) {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(REPO_ROOT, inputPath);
}

async function createInferJob(name: string, body: any) {
  const resolvedConfig = await resolveInferenceConfig({
    ...(body.config ?? {}),
    prompt: String(body.config?.prompt || '').trim(),
    gpu_ids: String(body.config?.gpu_ids || '').trim(),
    offload_mode: body.config?.offload_mode,
    output_prefix: String(body.config?.output_prefix || '').trim(),
    checkpoint_path: String(body.config?.checkpoint_path || '').trim(),
    base_model: String(body.config?.base_model || 'Qwen/Qwen-Image-2512').trim(),
    use_lora: body.config?.use_lora == null ? undefined : Boolean(body.config.use_lora),
    seed: Number(body.config?.seed ?? 0),
    num_inference_steps: Number(body.config?.num_inference_steps ?? 40),
    source_train_job_id: body.config?.source_train_job_id || null,
  });
  if (!resolvedConfig.prompt) {
    throw new JobIntakeError('Prompt is required');
  }
  if (!resolvedConfig.gpu_ids) {
    throw new JobIntakeError('GPU IDs are required');
  }

  const running = await prisma.job.findMany({
    where: { status: 'running' },
    select: { gpu_ids: true },
  });
  if (isGpuBusy(resolvedConfig.gpu_ids, running.map(item => item.gpu_ids))) {
    throw new JobIntakeError('Selected GPU is busy', 409);
  }

  const artifactRoot = await defaultInferOutputPath(name);
  return prisma.job.create({
    data: {
      name,
      job_type: 'infer',
      status: 'queued',
      gpu_ids: resolvedConfig.gpu_ids,
      queue_position: 0,
      artifact_root: artifactRoot,
      config_json: serializeJobSpec(createInferJobSpec(resolvedConfig)),
      progress_total: 1,
      info: 'Queued inference job',
    },
  });
}
