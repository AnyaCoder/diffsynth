import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { Job } from '@prisma/client';
import prisma from './prisma';
import { DB_PATH, PYTHON_ROOT, REPO_ROOT, UI_ROOT } from './paths';
import { getJobRunDirectory, prepareJobRunDirectory, readPidFile } from './jobRunDirectory';
import { resolveCondaPath } from './pythonPath';
import { isPidAlive, stopPidTree } from './process';
import { proxyGenerateInferenceService, findMatchingRunningInferenceService } from './inferenceServices';
import { readInferConfigFromJson } from '../domain/jobSpec';

export async function queueTrainJob(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return null;
  if (job.job_type !== 'train') {
    throw new Error('Only train jobs can be queued');
  }

  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'queued', info: 'Queued for training' },
  });
  await prisma.queue.upsert({
    where: { gpu_ids: job.gpu_ids },
    update: { is_running: true },
    create: { gpu_ids: job.gpu_ids, is_running: true },
  });
  return job;
}

export async function startJobNow(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return null;
  if (job.job_type === 'infer') {
    const claimed = await prisma.job.updateMany({
      where: {
        id: job.id,
        status: { in: ['draft', 'queued', 'stopped', 'error'] },
      },
      data: {
        status: 'running',
        stop_requested: false,
        finished_at: null,
        pid: null,
        info: `Starting ${job.job_type} job...`,
      },
    });
    if (claimed.count === 0) {
      throw new Error(`Inference job cannot be started from status ${job.status}`);
    }
    const config = readInferConfigFromJson(job.config_json);
    const reusableService = await findMatchingRunningInferenceService(config);
    if (reusableService) {
      await runInferenceViaService(job, reusableService.id);
      return prisma.job.findUnique({ where: { id: job.id } });
    }
  }
  const [activeJobs, activeServices] = await Promise.all([
    prisma.job.findMany({
      where: {
        id: { not: job.id },
        status: { in: ['running', 'stopping'] },
      },
      select: { gpu_ids: true },
    }),
    prisma.inferenceService.findMany({
      where: {
        status: { in: ['starting', 'running', 'stopping'] },
      },
      select: { gpu_ids: true },
    }),
  ]);
  const wanted = new Set(job.gpu_ids.split(',').map(item => item.trim()).filter(Boolean));
  const overlaps = [...activeJobs.map(item => item.gpu_ids), ...activeServices.map(item => item.gpu_ids)].some(ids =>
    ids.split(',').map(item => item.trim()).some(id => wanted.has(id)),
  );
  if (overlaps) {
    throw new Error(`GPU ${job.gpu_ids} is busy`);
  }
  const condaEnvRow = await prisma.settings.findFirst({ where: { key: 'CONDA_ENV_NAME' } });
  const envName = condaEnvRow?.value?.trim() || process.env.CONDA_ENV_NAME || 'trainer';
  const runDir = prepareJobRunDirectory(job.artifact_root, job.config_json);

  if (job.job_type !== 'infer') {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'running',
        stop_requested: false,
        info: `Starting ${job.job_type} job...`,
      },
    });
  }

  try {
    const pid = spawnBridgeWithEnv(job, envName);
    await prisma.job.update({
      where: { id: job.id },
      data: {
        pid,
        info: `Running on GPU ${job.gpu_ids}`,
      },
    });
    if (pid != null) {
      fs.writeFileSync(runDir.bridgePidPath, String(pid), 'utf-8');
    }
  } catch (error: any) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'error',
        info: error?.message || 'Failed to launch bridge',
      },
    });
  }

  return job;
}

export async function requestStopJob(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return null;

  if (!['queued', 'running', 'stopping'].includes(job.status)) {
    if (job.stop_requested) {
      return prisma.job.update({
        where: { id: jobId },
        data: { stop_requested: false, pid: null },
      });
    }
    return job;
  }

  const livePids = liveJobPids(job);
  if (livePids.length === 0) {
    return markJobStopped(job, stoppedInfo(job));
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      stop_requested: true,
      status: 'stopping',
      info: `Stopping ${job.job_type} job...`,
    },
  });

  for (const pid of livePids) {
    stopPidTree(pid);
  }

  return job;
}

export async function reconcileStaleStoppingJob(job: Job) {
  if (job.status !== 'stopping') return job;
  if (liveJobPids(job).length > 0) return job;
  return markJobStopped(job, stoppedInfo(job));
}

export async function reconcileStaleStoppingJobs() {
  const jobs = await prisma.job.findMany({ where: { status: 'stopping' } });
  for (const job of jobs) {
    await reconcileStaleStoppingJob(job);
  }
}

function jobPidCandidates(job: Pick<Job, 'artifact_root' | 'job_type' | 'pid'>) {
  const runDir = getJobRunDirectory(job.artifact_root);
  return [
    job.job_type === 'train' ? readPidFile(runDir.trainChildPidPath) : null,
    job.pid ?? null,
    readPidFile(runDir.bridgePidPath),
  ].filter((pid): pid is number => Boolean(pid));
}

function liveJobPids(job: Pick<Job, 'artifact_root' | 'job_type' | 'pid'>) {
  return Array.from(new Set(jobPidCandidates(job))).filter(isPidAlive);
}

function stoppedInfo(job: Pick<Job, 'job_type'>) {
  return job.job_type === 'infer' ? 'Inference stopped' : 'Training stopped';
}

function markJobStopped(job: Job, info: string) {
  return prisma.job.update({
    where: { id: job.id },
    data: {
      status: 'stopped',
      stop_requested: false,
      info,
      pid: null,
      finished_at: job.finished_at ?? new Date(),
    },
  });
}

function spawnBridgeWithEnv(job: Job, envName: string) {
  const bridgeFile = path.join(PYTHON_ROOT, job.job_type === 'train' ? 'run_train_job.py' : 'run_infer_job.py');
  const args = ['run', '-n', envName, 'python', bridgeFile, '--job-id', job.id, '--db-path', DB_PATH];
  const subprocess = spawn(resolveCondaPath(), args, {
    cwd: REPO_ROOT,
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      CUDA_DEVICE_ORDER: 'PCI_BUS_ID',
      CUDA_VISIBLE_DEVICES: job.gpu_ids,
      QWEN_UI_ROOT: UI_ROOT,
      QWEN_REPO_ROOT: REPO_ROOT,
      QWEN_JOB_ROOT: job.artifact_root,
      QWEN_UI_DB_PATH: DB_PATH,
      QWEN_CONDA_ENV_NAME: envName,
    },
  });
  subprocess.unref();
  return subprocess.pid ?? null;
}

async function runInferenceViaService(job: Job, serviceId: string) {
  const runDir = prepareJobRunDirectory(job.artifact_root, job.config_json);
  const config = readInferConfigFromJson(job.config_json);
  const logLines = [
    `Reusing running inference service ${serviceId}`,
    `prompt=${config.prompt}`,
    `seed=${config.seed}`,
    `steps=${config.num_inference_steps}`,
  ].join('\n');
  fs.writeFileSync(runDir.logPath, `${logLines}\n`, 'utf-8');
  fs.writeFileSync(
    runDir.statePath,
    JSON.stringify({ status: 'running', progress_current: 0, progress_total: 1 }, null, 2),
    'utf-8',
  );

  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: 'running',
      stop_requested: false,
      info: `Reusing service ${serviceId}`,
      pid: null,
      progress_total: 1,
      progress_current: 0,
      finished_at: null,
    },
  });

  try {
    const result = await proxyGenerateInferenceService(serviceId, {
      prompt: config.prompt,
      seed: config.seed,
      num_inference_steps: config.num_inference_steps,
      output_prefix: config.output_prefix || 'result',
    });

    const remoteOutputPath = String(result.output_path || '').trim();
    const outputExt = path.extname(remoteOutputPath) || '.jpg';
    const outputName = `${config.output_prefix || 'result'}_${Date.now()}${outputExt}`;
    const localOutputPath = path.join(job.artifact_root, outputName);
    if (remoteOutputPath && fs.existsSync(remoteOutputPath)) {
      fs.copyFileSync(remoteOutputPath, localOutputPath);
    }

    const resultPayload = {
      ...result,
      output_path: localOutputPath,
      checkpoint_path: config.checkpoint_path,
      base_model: config.base_model,
      use_lora: Boolean(config.use_lora),
      source_train_job_id: config.source_train_job_id ?? null,
      service_id: serviceId,
      served_by: 'service',
    };
    fs.writeFileSync(runDir.resultPath, JSON.stringify(resultPayload, null, 2), 'utf-8');
    fs.writeFileSync(
      runDir.statePath,
      JSON.stringify({ status: 'completed', progress_current: 1, progress_total: 1 }, null, 2),
      'utf-8',
    );
    fs.appendFileSync(runDir.logPath, `Saved image to ${localOutputPath}\n`, 'utf-8');

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'completed',
        info: `Inference completed via service ${serviceId}`,
        progress_current: 1,
        progress_total: 1,
        finished_at: new Date(),
        pid: null,
      },
    });
  } catch (error: any) {
    fs.writeFileSync(
      runDir.statePath,
      JSON.stringify({ status: 'error', progress_current: 0, progress_total: 1 }, null, 2),
      'utf-8',
    );
    fs.appendFileSync(runDir.logPath, `ERROR: ${error?.message || 'Failed to reuse service'}\n`, 'utf-8');
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: 'error',
        info: error?.message || 'Failed to reuse inference service',
        finished_at: new Date(),
        pid: null,
      },
    });
  }
}
