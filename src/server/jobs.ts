import fs from 'fs';
import path from 'path';
import prisma from './prisma';
import { InferJobConfig, JobArtifact, JobResult } from '../types';
import { getInferenceRoot, getTrainingRoot } from './settings';
import { ensureDir } from '../paths';
import { classifyJobRunFile, getJobRunDirectory } from './jobRunDirectory';
import { readTextLogFile } from './logs';
import { normalizeInferenceOffloadMode } from '../domain/inferenceRuntime';
export { buildDefaultTrainConfig, buildTrainCommand, getTrainProcessCount, resolveTrainCommandConfig } from '../domain/trainCommand';

function listCheckpointFiles(root: string) {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .map(name => path.join(root, name))
    .filter(fullPath => fs.existsSync(fullPath) && fs.statSync(fullPath).isFile() && fullPath.endsWith('.safetensors'));
}

function checkpointSortKey(fullPath: string) {
  const name = path.basename(fullPath);
  const epochMatch = name.match(/^epoch-(\d+)\.safetensors$/);
  if (epochMatch) {
    return { epoch: Number(epochMatch[1]), mtime: 0 };
  }
  return { epoch: -1, mtime: fs.statSync(fullPath).mtimeMs };
}

function findLatestCheckpoint(root: string) {
  const files = listCheckpointFiles(root);
  if (files.length === 0) return null;
  return files.sort((left, right) => {
    const a = checkpointSortKey(left);
    const b = checkpointSortKey(right);
    if (a.epoch !== b.epoch) return b.epoch - a.epoch;
    return b.mtime - a.mtime;
  })[0];
}

export async function listArtifacts(jobId: string): Promise<JobArtifact[]> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return [];
  const root = job.artifact_root;
  if (!fs.existsSync(root)) return [];
  const items: JobArtifact[] = [];
  for (const name of fs.readdirSync(root)) {
    const fullPath = path.join(root, name);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) continue;
    let kind: JobArtifact['kind'] | null = null;
    if (name.endsWith('.safetensors')) kind = 'checkpoint';
    else if (/\.(png|jpg|jpeg|webp)$/i.test(name)) kind = 'image';
    else kind = classifyJobRunFile(name);
    if (!kind) continue;
    items.push({
      kind,
      name,
      path: fullPath,
      size: stat.size,
      created_at: stat.mtime.toISOString(),
    });
  }
  return items.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function listResults(jobId: string): Promise<JobResult[]> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return [];
  if (job.job_type === 'train') {
    const evalDir = path.join(job.artifact_root, 'eval');
    if (!fs.existsSync(evalDir)) return [];
    const results: JobResult[] = [];
    for (const name of fs.readdirSync(evalDir)) {
      if (!name.endsWith('.json')) continue;
      const fullPath = path.join(evalDir, name);
      try {
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        if (!parsed.image_path) continue;
        results.push({
          job_id: job.id,
          job_name: job.name,
          job_status: job.status,
          gpu_ids: job.gpu_ids,
          image_path: parsed.image_path,
          image_url: `/api/files/${encodeURIComponent(parsed.image_path)}`,
          prompt: parsed.prompt ?? '',
          seed: parsed.seed ?? 0,
          num_inference_steps: parsed.num_inference_steps ?? 0,
          checkpoint_path: parsed.checkpoint_path ?? '',
          offload_mode: normalizeInferenceOffloadMode(parsed.offload_mode),
          created_at: parsed.created_at ?? fs.statSync(fullPath).mtime.toISOString(),
          source_train_job_id: job.id,
          served_by: 'ephemeral',
          base_model: undefined,
          use_lora: true,
          step: typeof parsed.step === 'number' ? parsed.step : null,
          epoch: typeof parsed.epoch === 'number' ? parsed.epoch : null,
        });
      } catch {
        continue;
      }
    }
    return results.sort((left, right) => {
      const stepDelta = (right.step ?? -1) - (left.step ?? -1);
      if (stepDelta !== 0) return stepDelta;
      return right.created_at.localeCompare(left.created_at);
    });
  }
  const runDir = getJobRunDirectory(job.artifact_root);
  if (!fs.existsSync(runDir.root) || !fs.existsSync(runDir.resultPath)) return [];
  const parsed = JSON.parse(fs.readFileSync(runDir.resultPath, 'utf-8'));
  const imagePath = parsed.output_path;
  return [
    {
      job_id: job.id,
      job_name: job.name,
      job_status: job.status,
      gpu_ids: job.gpu_ids,
      image_path: imagePath,
      image_url: `/api/files/${encodeURIComponent(imagePath)}`,
      prompt: parsed.prompt,
      seed: parsed.seed,
      num_inference_steps: parsed.num_inference_steps,
      checkpoint_path: parsed.checkpoint_path,
      offload_mode: normalizeInferenceOffloadMode(parsed.offload_mode),
      created_at: parsed.created_at,
      source_train_job_id: parsed.source_train_job_id ?? null,
      service_id: parsed.service_id ?? null,
      served_by: parsed.served_by ?? 'ephemeral',
      base_model: parsed.base_model ?? null,
      use_lora: parsed.use_lora ?? false,
    },
  ];
}

export async function listRecentInferenceResults(limit = 18): Promise<JobResult[]> {
  const jobs = await prisma.job.findMany({
    where: {
      job_type: 'infer',
      status: { in: ['completed', 'error', 'running'] },
      is_archived: false,
    },
    orderBy: { updated_at: 'desc' },
    take: Math.max(limit * 2, limit),
  });

  const results: JobResult[] = [];
  for (const job of jobs) {
    const runDir = getJobRunDirectory(job.artifact_root);
    if (!fs.existsSync(runDir.resultPath)) continue;
    const parsed = JSON.parse(fs.readFileSync(runDir.resultPath, 'utf-8'));
    if (!parsed.output_path) continue;
    results.push({
      job_id: job.id,
      job_name: job.name,
      job_status: job.status,
      gpu_ids: job.gpu_ids,
      image_path: parsed.output_path,
      image_url: `/api/files/${encodeURIComponent(parsed.output_path)}`,
      prompt: parsed.prompt,
      seed: parsed.seed,
      num_inference_steps: parsed.num_inference_steps,
      checkpoint_path: parsed.checkpoint_path,
      offload_mode: normalizeInferenceOffloadMode(parsed.offload_mode),
      created_at: parsed.created_at,
      source_train_job_id: parsed.source_train_job_id ?? null,
      service_id: parsed.service_id ?? null,
      served_by: parsed.served_by ?? 'ephemeral',
      base_model: parsed.base_model ?? null,
      use_lora: parsed.use_lora ?? false,
    });
    if (results.length >= limit) break;
  }
  return results;
}

export async function readJobLog(jobId: string, offset: number) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Job not found');
  const runDir = getJobRunDirectory(job.artifact_root);
  return readTextLogFile(runDir.logPath, offset);
}

export async function ensureQueue(gpuIds: string) {
  return prisma.queue.upsert({
    where: { gpu_ids: gpuIds },
    update: {},
    create: { gpu_ids: gpuIds, is_running: false },
  });
}

export async function resolveInferenceConfig(config: InferJobConfig): Promise<InferJobConfig> {
  let checkpointPath = config.checkpoint_path?.trim();
  const useLora = config.use_lora ?? Boolean(checkpointPath || config.source_train_job_id);

  if (useLora && checkpointPath && fs.existsSync(checkpointPath) && fs.statSync(checkpointPath).isDirectory()) {
    checkpointPath = findLatestCheckpoint(checkpointPath) ?? '';
  }

  if (useLora && (!checkpointPath || !fs.existsSync(checkpointPath)) && config.source_train_job_id) {
    const sourceJob = await prisma.job.findUnique({ where: { id: config.source_train_job_id } });
    if (!sourceJob || sourceJob.job_type !== 'train') {
      throw new Error('Source train job not found');
    }
    checkpointPath = findLatestCheckpoint(sourceJob.artifact_root) ?? '';
  }

  if (useLora && !checkpointPath) {
    throw new Error('Checkpoint path is required when using LoRA');
  }

  if (useLora && !fs.existsSync(checkpointPath)) {
    throw new Error(`Checkpoint not found: ${checkpointPath}`);
  }

  if (useLora && fs.statSync(checkpointPath).isDirectory()) {
    throw new Error(`Checkpoint path must be a .safetensors file: ${checkpointPath}`);
  }

  return {
    ...config,
    checkpoint_path: useLora ? checkpointPath : '',
    offload_mode: normalizeInferenceOffloadMode(config.offload_mode),
    use_lora: useLora,
    source_train_job_id: useLora ? config.source_train_job_id ?? null : null,
    preferred_service_id: config.preferred_service_id?.trim() || null,
  };
}

export async function defaultTrainOutputPath(name: string) {
  const root = await getTrainingRoot();
  ensureDir(root);
  return path.join(root, name);
}

export async function defaultInferOutputPath(name: string) {
  const root = await getInferenceRoot();
  ensureDir(root);
  return path.join(root, name);
}
