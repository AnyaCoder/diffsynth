import fs from 'fs';
import http from 'http';
import path from 'path';
import { spawn } from 'child_process';
import prisma from './prisma';
import { DB_PATH, ensureDir, PYTHON_ROOT, REPO_ROOT, UI_ROOT } from './paths';
import { isGpuBusy, stopPidTree } from './process';
import { resolveInferenceConfig } from './jobs';
import { getCondaEnvName, getInferenceRoot } from './settings';
import { getJobRunDirectory, prepareJobRunDirectory, readPidFile } from './jobRunDirectory';
import { readTextLogFile } from './logs';
import { resolveCondaPath } from './pythonPath';
import { ensurePathInsideRoots } from './security';
import { readInferConfigFromJson } from '../domain/jobSpec';

interface InferenceServiceRuntime {
  id: string;
  name: string;
  gpu_ids: string;
  artifact_root: string;
}

function resolveServiceRoot(name: string, root: string) {
  return path.join(root, 'services', name);
}

function buildServiceSpec(service: Awaited<ReturnType<typeof getInferenceService>>) {
  return {
    spec_version: 1,
    service_type: 'infer_service',
    config: {
      name: service?.name,
      gpu_ids: service?.gpu_ids,
      base_model: service?.base_model,
      checkpoint_path: service?.checkpoint_path,
      use_lora: service?.use_lora,
      source_train_job_id: service?.source_train_job_id ?? null,
    },
  };
}

export async function listInferenceServices() {
  return prisma.inferenceService.findMany({
    orderBy: { created_at: 'desc' },
  });
}

export async function getInferenceService(id: string) {
  return prisma.inferenceService.findUnique({ where: { id } });
}

export async function createInferenceServiceFromRequest(body: any) {
  const name = String(body.name || '').trim();
  if (!name) {
    throw new Error('Service name is required');
  }

  const resolvedConfig = await resolveInferenceConfig({
    ...(body.config ?? {}),
    prompt: String(body.config?.prompt || '').trim(),
    gpu_ids: String(body.config?.gpu_ids || '').trim(),
    output_prefix: '',
    checkpoint_path: String(body.config?.checkpoint_path || '').trim(),
    base_model: String(body.config?.base_model || 'Qwen/Qwen-Image-2512').trim(),
    use_lora: body.config?.use_lora == null ? undefined : Boolean(body.config.use_lora),
    seed: 0,
    num_inference_steps: 1,
    source_train_job_id: body.config?.source_train_job_id || null,
  });

  if (!resolvedConfig.gpu_ids) {
    throw new Error('GPU IDs are required');
  }

  const inferenceRoot = await getInferenceRoot();
  const artifactRoot = resolveServiceRoot(name, inferenceRoot);
  ensureDir(artifactRoot);
  ensureDir(getInferenceServiceRuntimeRoot(artifactRoot));

  return prisma.inferenceService.create({
    data: {
      name,
      status: 'draft',
      gpu_ids: resolvedConfig.gpu_ids,
      base_model: resolvedConfig.base_model,
      checkpoint_path: resolvedConfig.checkpoint_path,
      use_lora: Boolean(resolvedConfig.use_lora),
      source_train_job_id: resolvedConfig.source_train_job_id ?? null,
      artifact_root: artifactRoot,
      info: 'Draft inference service',
    },
  });
}

export async function deleteInferenceService(id: string) {
  const service = await prisma.inferenceService.findUnique({ where: { id } });
  if (!service) return null;
  if (['starting', 'running', 'stopping'].includes(service.status)) {
    throw new Error('Stop the service before deleting it');
  }
  const inferenceRoot = await getInferenceRoot();
  const safeArtifactRoot = ensurePathInsideRoots(service.artifact_root, [inferenceRoot]);
  if (fs.existsSync(safeArtifactRoot)) {
    fs.rmSync(safeArtifactRoot, { recursive: true, force: true });
  }
  await prisma.inferenceService.delete({ where: { id } });
  return service;
}

export async function stopInferenceService(id: string) {
  const service = await prisma.inferenceService.findUnique({ where: { id } });
  if (!service) return null;
  if (service.status === 'queued') {
    return prisma.inferenceService.update({
      where: { id },
      data: {
        status: 'stopped',
        stop_requested: false,
        info: 'Queued service cancelled',
        finished_at: new Date(),
      },
    });
  }
  if (!['starting', 'running', 'stopping'].includes(service.status)) {
    return service;
  }
  await prisma.inferenceService.update({
    where: { id },
    data: {
      status: 'stopping',
      stop_requested: true,
      info: 'Stopping inference service...',
    },
  });
  const runDir = getJobRunDirectory(getInferenceServiceRuntimeRoot(service.artifact_root));
  const effectivePid = readPidFile(runDir.bridgePidPath) ?? service.pid ?? null;
  if (effectivePid) {
    stopPidTree(effectivePid);
  }
  return prisma.inferenceService.findUnique({ where: { id } });
}

export async function queueInferenceService(id: string) {
  const service = await prisma.inferenceService.findUnique({ where: { id } });
  if (!service) return null;
  if (['starting', 'running', 'stopping'].includes(service.status)) {
    return service;
  }
  return prisma.inferenceService.update({
    where: { id },
    data: {
      status: 'queued',
      stop_requested: false,
      finished_at: null,
      info: 'Queued inference service',
    },
  });
}

export async function startInferenceServiceNow(id: string) {
  const service = await prisma.inferenceService.findUnique({ where: { id } });
  if (!service) return null;

  const runDir = prepareJobRunDirectory(
    getInferenceServiceRuntimeRoot(service.artifact_root),
    JSON.stringify(buildServiceSpec(service), null, 2),
  );
  const envName = await getCondaEnvName();

  await prisma.inferenceService.update({
    where: { id },
    data: {
      status: 'starting',
      stop_requested: false,
      finished_at: null,
      info: `Starting inference service on GPU ${service.gpu_ids}...`,
      pid: null,
    },
  });

  try {
    const subprocess = spawnInferenceServiceBridge(service, envName);
    if (subprocess.pid != null) {
      fs.writeFileSync(runDir.bridgePidPath, String(subprocess.pid), 'utf-8');
    }
    await prisma.inferenceService.update({
      where: { id },
      data: {
        pid: subprocess.pid ?? null,
        info: `Loading model on GPU ${service.gpu_ids}...`,
      },
    });
  } catch (error: any) {
    await prisma.inferenceService.update({
      where: { id },
      data: {
        status: 'error',
        pid: null,
        info: error?.message || 'Failed to launch inference service',
        finished_at: new Date(),
      },
    });
  }

  return prisma.inferenceService.findUnique({ where: { id } });
}

export async function processQueuedInferenceServices() {
  const queuedServices = await prisma.inferenceService.findMany({
    where: { status: 'queued' },
    orderBy: { created_at: 'asc' },
  });
  const claimedGpuIds: string[] = [];

  for (const service of queuedServices) {
    const activeJobs = await prisma.job.findMany({
      where: { status: { in: ['running', 'stopping'] } },
      select: { gpu_ids: true },
    });
    const activeServices = await prisma.inferenceService.findMany({
      where: {
        id: { not: service.id },
        status: { in: ['starting', 'running', 'stopping'] },
      },
      select: { gpu_ids: true },
    });

    if (
      isGpuBusy(service.gpu_ids, [
        ...activeJobs.map(item => item.gpu_ids),
        ...activeServices.map(item => item.gpu_ids),
        ...claimedGpuIds,
      ])
    ) {
      continue;
    }

    await startInferenceServiceNow(service.id);
    claimedGpuIds.push(service.gpu_ids);
  }
}

export async function markInferenceServiceStarted(id: string, pid: number, port: number) {
  return prisma.inferenceService.update({
    where: { id },
    data: {
      status: 'running',
      pid,
      port,
      endpoint_url: `http://127.0.0.1:${port}`,
      stop_requested: false,
      info: `Serving on port ${port}`,
    },
  });
}

export async function markInferenceServiceExited(id: string, status: 'stopped' | 'error', info: string) {
  return prisma.inferenceService.update({
    where: { id },
    data: {
      status,
      pid: null,
      finished_at: new Date(),
      info,
    },
  });
}

export async function readServiceLog(id: string, offset: number) {
  const service = await prisma.inferenceService.findUnique({ where: { id } });
  if (!service) throw new Error('Service not found');
  const runDir = getJobRunDirectory(getInferenceServiceRuntimeRoot(service.artifact_root));
  return readTextLogFile(runDir.logPath, offset);
}

export async function getInferenceServiceHealth(id: string) {
  const service = await prisma.inferenceService.findUnique({ where: { id } });
  if (!service) return null;
  if (!service.endpoint_url || !['starting', 'running', 'stopping'].includes(service.status)) {
    return {
      reachable: false,
      status: service.status,
      endpoint_url: service.endpoint_url,
      error: service.status === 'queued' ? 'Service is queued' : 'Service is not running',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`${service.endpoint_url}/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await response.json();
    return {
      reachable: response.ok,
      endpoint_url: service.endpoint_url,
      ...payload,
    };
  } catch (error: any) {
    return {
      reachable: false,
      status: service.status,
      endpoint_url: service.endpoint_url,
      error: error?.message || 'Failed to reach service health endpoint',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function proxyGenerateInferenceService(id: string, payload: unknown) {
  const service = await prisma.inferenceService.findUnique({ where: { id } });
  if (!service) {
    throw new Error('Service not found');
  }
  if (!service.endpoint_url || service.status !== 'running') {
    throw new Error('Service is not running');
  }

  return postJsonWithTimeout(`${service.endpoint_url}/generate`, payload ?? {}, 30 * 60 * 1000);
}

export async function findMatchingRunningInferenceService(config: {
  gpu_ids: string;
  base_model: string;
  checkpoint_path: string;
  use_lora?: boolean;
  source_train_job_id?: string | null;
  preferred_service_id?: string | null;
}) {
  const runningServices = await prisma.inferenceService.findMany({
    where: { status: 'running' },
    orderBy: { updated_at: 'desc' },
  });

  const preferredId = config.preferred_service_id?.trim() || null;
  const wantUseLora = Boolean(config.use_lora);
  const normalizedGpuIds = config.gpu_ids.trim();
  const normalizedBaseModel = config.base_model.trim();
  const normalizedCheckpoint = config.checkpoint_path.trim();
  const normalizedSourceTrainJobId = config.source_train_job_id?.trim() || null;

  const matches = runningServices.filter(service => {
    if (service.gpu_ids.trim() !== normalizedGpuIds) return false;
    if (service.base_model.trim() !== normalizedBaseModel) return false;
    if (Boolean(service.use_lora) !== wantUseLora) return false;
    if (!wantUseLora) return true;

    const serviceCheckpoint = service.checkpoint_path.trim();
    const serviceSourceTrainJobId = service.source_train_job_id?.trim() || null;
    if (normalizedSourceTrainJobId && serviceSourceTrainJobId === normalizedSourceTrainJobId) return true;
    return serviceCheckpoint === normalizedCheckpoint;
  });

  if (preferredId) {
    const preferred = matches.find(service => service.id === preferredId);
    if (preferred) return preferred;
  }

  return matches[0] ?? null;
}

export async function findMatchingRunningInferenceServiceForJobConfig(configJson: string) {
  const config = readInferConfigFromJson(configJson);
  return findMatchingRunningInferenceService(config);
}

export function getInferenceServiceRuntimeRoot(serviceRoot: string) {
  return path.join(path.isAbsolute(serviceRoot) ? serviceRoot : path.resolve(REPO_ROOT, serviceRoot), 'runtime');
}

function postJsonWithTimeout(urlValue: string, payload: unknown, timeoutMs: number) {
  return new Promise<any>((resolve, reject) => {
    const url = new URL(urlValue);
    const body = JSON.stringify(payload ?? {});
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      },
      response => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', chunk => {
          raw += chunk;
        });
        response.on('end', () => {
          const data = raw ? safeJsonParse(raw) : {};
          if (response.statusCode == null || response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(typeof data?.detail === 'string' ? data.detail : `Service request failed with ${response.statusCode}`));
            return;
          }
          resolve(data);
        });
      },
    );

    request.on('timeout', () => {
      request.destroy(new Error(`Service request timed out after ${Math.round(timeoutMs / 1000)}s`));
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function spawnInferenceServiceBridge(service: InferenceServiceRuntime, envName: string) {
  const bridgeFile = path.join(PYTHON_ROOT, 'run_infer_service.py');
  const args = ['run', '-n', envName, 'python', bridgeFile, '--service-id', service.id, '--db-path', DB_PATH];
  const subprocess = spawn(resolveCondaPath(), args, {
    cwd: REPO_ROOT,
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      CUDA_DEVICE_ORDER: 'PCI_BUS_ID',
      CUDA_VISIBLE_DEVICES: service.gpu_ids,
      QWEN_UI_ROOT: UI_ROOT,
      QWEN_REPO_ROOT: REPO_ROOT,
      QWEN_SERVICE_ROOT: service.artifact_root,
      QWEN_UI_DB_PATH: DB_PATH,
      QWEN_CONDA_ENV_NAME: envName,
    },
  });
  subprocess.unref();
  return subprocess;
}
