import { randomUUID } from 'crypto';
import fs from 'fs';
import type { InferenceService, Job } from '@prisma/client';
import prisma from './prisma';
import { createJobFromRequest } from './jobIntake';
import { startJobNow } from './jobLifecycle';
import { getInferenceServiceHealth } from './inferenceServices';
import { listResults } from './jobs';
import { readInferConfigFromJson } from '../domain/jobSpec';

const ALGORITHM_JOB_PREFIX = 'algorithm_v1_';
const DEFAULT_GPU_IDS = '6';
const MAX_BATCH_SIZE = 8;
const MAX_PROMPT_LENGTH = 4000;
const MAX_SEED = 0xffffffff;
const BATCH_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ParsedTextToImageRequest {
  count: number;
  modelId: string | null;
  prompt: string;
  seed: number;
  steps: number;
}

interface AlgorithmErrorDetail {
  field?: string;
  supported?: unknown;
  [key: string]: unknown;
}

export class AlgorithmApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly detail: AlgorithmErrorDetail = {},
  ) {
    super(message);
  }

  toPayload() {
    return {
      code: this.code,
      message: this.message,
      ...this.detail,
    };
  }
}

export async function getAlgorithmCapabilities() {
  const services = await listConfiguredServices();
  const serviceCapabilities = await Promise.all(
    services.map(async service => {
      const health = await getInferenceServiceHealth(service.id);
      return {
        model_id: service.id,
        name: service.name,
        base_model: service.base_model,
        gpu_ids: service.gpu_ids,
        use_lora: service.use_lora,
        ready: Boolean(health?.reachable),
      };
    }),
  );
  const readyServices = serviceCapabilities.filter(service => service.ready);

  return {
    api_version: '1.0',
    service: 'diffsynth-text-to-image',
    ready: readyServices.length > 0,
    default_model_id: readyServices[0]?.model_id ?? null,
    models: serviceCapabilities,
    text_to_image: {
      execution: 'asynchronous_batch',
      inputs: {
        prompt: { required: true, max_length: MAX_PROMPT_LENGTH },
        seed: { required: false, default: 0, min: 0, max: MAX_SEED, batch_behavior: 'increment_per_image' },
        steps: { required: false, default: 40, min: 1, max: 100 },
        count: { required: false, default: 1, min: 1, max: MAX_BATCH_SIZE },
        resolution: { required: false, default: '1024x1024', supported: ['1024x1024'] },
        modalities: { required: false, default: ['visible'], supported: ['visible'] },
        model_id: { required: false, values: serviceCapabilities.map(service => service.model_id) },
      },
      unsupported: [
        'infrared',
        'multispectral',
        'sar',
        'negative_prompt',
        'style',
        'augmentations',
        'multi_view',
        'dom',
        'gsd',
        'mask',
        'depth',
      ],
      output: { format: 'jpeg', images_per_internal_job: 1 },
      stop: { supported: true, scope: 'queued_items_only' },
    },
  };
}

export async function createTextToImageBatch(input: unknown) {
  const request = parseTextToImageRequest(input);
  const service = await selectReadyService(request.modelId);
  const batchId = randomUUID();
  const createdJobs: Job[] = [];

  try {
    for (let index = 0; index < request.count; index += 1) {
      const seed = (request.seed + index) % (MAX_SEED + 1);
      const job = await createJobFromRequest(
        {
          name: algorithmJobName(batchId, index),
          job_type: 'infer',
          config: {
            prompt: request.prompt,
            seed,
            num_inference_steps: request.steps,
            output_prefix: `result_${String(index + 1).padStart(2, '0')}`,
            gpu_ids: service.gpu_ids,
            offload_mode: service.offload_mode,
            checkpoint_path: service.checkpoint_path,
            base_model: service.base_model,
            use_lora: service.use_lora,
            source_train_job_id: service.source_train_job_id,
            preferred_service_id: service.id,
          },
        },
        { allowBusyGpu: true },
      );
      createdJobs.push(job);
    }
  } catch (error) {
    if (createdJobs.length > 0) {
      await prisma.job.deleteMany({ where: { id: { in: createdJobs.map(job => job.id) } } });
    }
    throw error;
  }

  return serializeBatch(batchId, createdJobs);
}

export async function getTextToImageBatch(batchId: string) {
  const jobs = await findBatchJobs(batchId);
  return serializeBatch(batchId, jobs);
}

export async function getTextToImageBatchResults(batchId: string) {
  const jobs = await findBatchJobs(batchId);
  const batch = serializeBatch(batchId, jobs);
  const resultSets = await Promise.all(jobs.map(job => listResults(job.id)));
  const results = resultSets.flatMap((items, index) =>
    items.map(item => ({
      item_id: jobs[index].id,
      index,
      image_url: `/api/algorithm/v1/jobs/${batchId}/results/${jobs[index].id}/image`,
      format: imageFormat(item.image_path),
      prompt: item.prompt,
      seed: item.seed,
      steps: item.num_inference_steps,
      created_at: item.created_at,
      model_id: item.service_id ?? readInferConfigFromJson(jobs[index].config_json).preferred_service_id ?? null,
    })),
  );

  return {
    batch_id: batchId,
    status: batch.status,
    total: batch.total,
    completed: batch.progress.completed,
    results,
  };
}

export async function getTextToImageResultFile(batchId: string, itemId: string) {
  const jobs = await findBatchJobs(batchId);
  const job = jobs.find(item => item.id === itemId);
  if (!job) {
    throw new AlgorithmApiError('RESULT_NOT_FOUND', 'Result item does not belong to this batch', 404, {
      field: 'item_id',
    });
  }
  const result = (await listResults(job.id))[0];
  if (!result?.image_path) {
    throw new AlgorithmApiError('RESULT_NOT_READY', 'Result image is not available yet', 404, {
      item_id: itemId,
    });
  }
  if (!fs.existsSync(result.image_path)) {
    throw new AlgorithmApiError('RESULT_FILE_MISSING', 'Result metadata exists but the image file is missing', 404, {
      item_id: itemId,
    });
  }
  return result.image_path;
}

export async function stopTextToImageBatch(batchId: string) {
  if (!BATCH_ID_PATTERN.test(batchId)) {
    throw new AlgorithmApiError('INVALID_BATCH_ID', 'Batch ID is invalid', 400, { field: 'batch_id' });
  }
  await prisma.$transaction(async transaction => {
    const jobs = await transaction.job.findMany({
      where: { name: { startsWith: algorithmBatchPrefix(batchId) } },
      orderBy: { created_at: 'asc' },
    });
    if (jobs.length === 0) {
      throw new AlgorithmApiError('BATCH_NOT_FOUND', 'Algorithm batch not found', 404);
    }
    const running = jobs.find(job => job.status === 'running' || job.status === 'stopping');
    if (running) {
      throw new AlgorithmApiError(
        'RUNNING_ITEM_CANNOT_BE_CANCELLED',
        'The running model request cannot be interrupted safely; queued items were left unchanged',
        409,
        { item_id: running.id },
      );
    }
    await transaction.job.updateMany({
      where: { id: { in: jobs.map(job => job.id) }, status: 'queued' },
      data: {
        status: 'stopped',
        stop_requested: false,
        info: 'Inference stopped',
        finished_at: new Date(),
        pid: null,
      },
    });
  });
  return getTextToImageBatch(batchId);
}

export async function processQueuedAlgorithmJobs() {
  const queuedJobs = await prisma.job.findMany({
    where: {
      job_type: 'infer',
      status: 'queued',
      name: { startsWith: ALGORITHM_JOB_PREFIX },
    },
    orderBy: { created_at: 'asc' },
    take: 32,
  });

  for (const job of queuedJobs) {
    const activeJob = await prisma.job.findFirst({
      where: {
        id: { not: job.id },
        gpu_ids: job.gpu_ids,
        status: { in: ['running', 'stopping'] },
      },
      select: { id: true },
    });
    if (activeJob) continue;

    try {
      await startJobNow(job.id);
    } catch (error: any) {
      const current = await prisma.job.findUnique({ where: { id: job.id }, select: { status: true } });
      if (current?.status === 'queued') {
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'error',
            info: error?.message || 'Failed to start algorithm job',
            finished_at: new Date(),
          },
        });
      }
    }
    return;
  }
}

function parseTextToImageRequest(input: unknown): ParsedTextToImageRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AlgorithmApiError('INVALID_REQUEST', 'Request body must be a JSON object', 400);
  }
  const body = input as Record<string, unknown>;
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    throw new AlgorithmApiError('MISSING_PROMPT', 'prompt is required', 400, { field: 'prompt' });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new AlgorithmApiError('INVALID_PROMPT', `prompt must be at most ${MAX_PROMPT_LENGTH} characters`, 400, {
      field: 'prompt',
    });
  }

  rejectUnsupportedFields(body);
  validateResolution(body);
  validateModalities(body);

  return {
    prompt,
    seed: parseInteger(body.seed, 0, 'seed', 0, MAX_SEED),
    steps: parseInteger(body.steps ?? body.num_inference_steps, 40, 'steps', 1, 100),
    count: parseInteger(body.count, 1, 'count', 1, MAX_BATCH_SIZE),
    modelId: optionalString(body.model_id ?? body.service_id),
  };
}

function rejectUnsupportedFields(body: Record<string, unknown>) {
  const unsupportedFields = [
    'negative_prompt',
    'negativePrompt',
    'style',
    'augmentations',
    'augmentation',
    'augmentation_strategies',
    'weather',
    'multi_view',
    'view_angles',
    'views',
    'dom',
    'dom_image',
    'gsd',
    'mask',
    'depth',
  ];
  const field = unsupportedFields.find(name => hasMeaningfulValue(body[name]));
  if (field) {
    throw new AlgorithmApiError(
      'UNSUPPORTED_PARAMETER',
      `${field} is not supported by the current text-to-image runtime`,
      422,
      { field },
    );
  }
}

function validateResolution(body: Record<string, unknown>) {
  const image = body.image && typeof body.image === 'object' && !Array.isArray(body.image) ? (body.image as Record<string, unknown>) : {};
  let width = body.width ?? image.width;
  let height = body.height ?? image.height;
  const resolution = body.resolution ?? image.resolution;

  if (typeof resolution === 'string' && resolution.trim()) {
    const match = resolution.trim().match(/^(\d+)\s*[xX\u00d7]\s*(\d+)$/);
    if (!match) {
      throw new AlgorithmApiError('INVALID_RESOLUTION', 'resolution must use WIDTHxHEIGHT format', 400, {
        field: 'resolution',
      });
    }
    width = Number(match[1]);
    height = Number(match[2]);
  } else if (resolution && typeof resolution === 'object' && !Array.isArray(resolution)) {
    const value = resolution as Record<string, unknown>;
    width = value.width;
    height = value.height;
  }

  const parsedWidth = parseInteger(width, 1024, 'width', 1, 16384);
  const parsedHeight = parseInteger(height, 1024, 'height', 1, 16384);
  if (parsedWidth !== 1024 || parsedHeight !== 1024) {
    throw new AlgorithmApiError('UNSUPPORTED_RESOLUTION', 'Only 1024x1024 is currently supported', 422, {
      field: 'resolution',
      supported: ['1024x1024'],
    });
  }
}

function validateModalities(body: Record<string, unknown>) {
  const raw = body.modalities ?? body.modality;
  if (raw == null || raw === '') return;
  const values = Array.isArray(raw) ? raw : [raw];
  if (values.length === 0) {
    throw new AlgorithmApiError('INVALID_MODALITY', 'At least one modality is required', 400, { field: 'modalities' });
  }
  const unsupported = values.find(value => !isVisibleModality(value));
  if (unsupported != null) {
    throw new AlgorithmApiError('UNSUPPORTED_MODALITY', 'Only visible RGB is currently supported', 422, {
      field: 'modalities',
      requested: unsupported,
      supported: ['visible'],
    });
  }
}

function parseInteger(value: unknown, defaultValue: number, field: string, min: number, max: number) {
  if (value == null || value === '') return defaultValue;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new AlgorithmApiError('INVALID_PARAMETER', `${field} must be an integer between ${min} and ${max}`, 400, {
      field,
      min,
      max,
    });
  }
  return parsed;
}

function optionalString(value: unknown) {
  if (value == null) return null;
  if (typeof value !== 'string') {
    throw new AlgorithmApiError('INVALID_PARAMETER', 'model_id must be a string', 400, { field: 'model_id' });
  }
  return value.trim() || null;
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value == null || value === false || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return true;
}

function isVisibleModality(value: unknown) {
  if (typeof value !== 'string') return false;
  return ['visible', 'visible_rgb', 'rgb', '\u53ef\u89c1\u5149'].includes(value.trim().toLowerCase());
}

async function selectReadyService(modelId: string | null) {
  const services = await listConfiguredServices();
  const service = modelId ? services.find(item => item.id === modelId) : services[0];
  if (!service) {
    throw new AlgorithmApiError(
      modelId ? 'UNSUPPORTED_MODEL' : 'NO_INFERENCE_SERVICE',
      modelId ? 'model_id is not available through this API' : 'No configured inference service is running',
      modelId ? 422 : 503,
      modelId ? { field: 'model_id', supported: services.map(item => item.id) } : {},
    );
  }

  const health = await getInferenceServiceHealth(service.id);
  if (!health?.reachable) {
    throw new AlgorithmApiError('SERVICE_UNAVAILABLE', 'The selected inference service is not reachable', 503, {
      model_id: service.id,
    });
  }
  return service;
}

function listConfiguredServices(): Promise<InferenceService[]> {
  const serviceId = process.env.ALGORITHM_API_SERVICE_ID?.trim();
  const gpuIds = process.env.ALGORITHM_API_GPU_IDS?.trim() || DEFAULT_GPU_IDS;
  return prisma.inferenceService.findMany({
    where: {
      status: 'running',
      ...(serviceId ? { id: serviceId } : { gpu_ids: gpuIds }),
    },
    orderBy: { updated_at: 'desc' },
  });
}

async function findBatchJobs(batchId: string) {
  if (!BATCH_ID_PATTERN.test(batchId)) {
    throw new AlgorithmApiError('INVALID_BATCH_ID', 'Batch ID is invalid', 400, { field: 'batch_id' });
  }
  const jobs = await prisma.job.findMany({
    where: { name: { startsWith: algorithmBatchPrefix(batchId) } },
    orderBy: { created_at: 'asc' },
  });
  if (jobs.length === 0) {
    throw new AlgorithmApiError('BATCH_NOT_FOUND', 'Algorithm batch not found', 404);
  }
  return jobs;
}

function serializeBatch(batchId: string, jobs: Job[]) {
  const statuses = jobs.map(job => job.status);
  const completed = statuses.filter(status => status === 'completed').length;
  const failed = statuses.filter(status => status === 'error').length;
  const stopped = statuses.filter(status => status === 'stopped').length;
  const running = statuses.filter(status => status === 'running' || status === 'stopping').length;
  const queued = statuses.filter(status => status === 'queued' || status === 'draft').length;
  const firstConfig = readInferConfigFromJson(jobs[0].config_json);

  return {
    batch_id: batchId,
    status: aggregateBatchStatus({ total: jobs.length, completed, failed, stopped, running, queued }),
    total: jobs.length,
    progress: { queued, running, completed, failed, stopped },
    prompt: firstConfig.prompt,
    resolution: { width: 1024, height: 1024 },
    modalities: ['visible'],
    model_id: firstConfig.preferred_service_id ?? null,
    created_at: jobs[0].created_at.toISOString(),
    updated_at: jobs.reduce((latest, job) => (job.updated_at > latest ? job.updated_at : latest), jobs[0].updated_at).toISOString(),
    items: jobs.map((job, index) => {
      const config = readInferConfigFromJson(job.config_json);
      return {
        item_id: job.id,
        index,
        status: normalizeItemStatus(job.status),
        seed: config.seed,
        error: job.status === 'error' ? job.info : null,
      };
    }),
    links: {
      self: `/api/algorithm/v1/jobs/${batchId}`,
      results: `/api/algorithm/v1/jobs/${batchId}/results`,
      stop: `/api/algorithm/v1/jobs/${batchId}/stop`,
    },
  };
}

function aggregateBatchStatus(counts: { total: number; completed: number; failed: number; stopped: number; running: number; queued: number }) {
  if (counts.completed === counts.total) return 'completed';
  if (counts.stopped === counts.total) return 'stopped';
  if (counts.completed + counts.failed + counts.stopped === counts.total) {
    if (counts.completed > 0) return 'partial';
    if (counts.failed > 0) return 'failed';
    return 'stopped';
  }
  if (counts.running > 0 || counts.completed > 0 || counts.failed > 0 || counts.stopped > 0) return 'running';
  return 'queued';
}

function normalizeItemStatus(status: string) {
  if (status === 'error') return 'failed';
  if (status === 'draft') return 'queued';
  return status;
}

function algorithmJobName(batchId: string, index: number) {
  return `${algorithmBatchPrefix(batchId)}${String(index + 1).padStart(2, '0')}`;
}

function algorithmBatchPrefix(batchId: string) {
  return `${ALGORITHM_JOB_PREFIX}${batchId}_`;
}

function imageFormat(imagePath: string) {
  const match = imagePath.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] === 'jpg' ? 'jpeg' : match?.[1] ?? 'jpeg';
}
