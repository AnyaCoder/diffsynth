import fs from 'fs';
import path from 'path';
import prisma from './prisma';
import { getInferenceRoot, getTrainingRoot } from './settings';
import { ensurePathInsideRoots } from './security';
import { REPO_ROOT } from './paths';

const ARCHIVE_BLOCKED_STATUSES = new Set(['queued', 'running', 'stopping']);
const DELETE_BLOCKED_STATUSES = new Set(['running', 'stopping']);
const ACTIVE_TRAIN_QUEUE_STATUSES = ['queued', 'running', 'stopping'];

function resolveArtifactRootForDeletion(artifactRoot: string) {
  return path.isAbsolute(artifactRoot) ? artifactRoot : path.resolve(REPO_ROOT, artifactRoot);
}

export async function archiveJob(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    throw new Error('Job not found');
  }
  if (ARCHIVE_BLOCKED_STATUSES.has(job.status)) {
    throw new Error('Active jobs cannot be archived');
  }
  return prisma.job.update({
    where: { id: jobId },
    data: { is_archived: true },
  });
}

export async function unarchiveJob(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    throw new Error('Job not found');
  }
  return prisma.job.update({
    where: { id: jobId },
    data: { is_archived: false },
  });
}

export async function deleteJobRecord(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    throw new Error('Job not found');
  }
  if (DELETE_BLOCKED_STATUSES.has(job.status)) {
    throw new Error('Active jobs cannot be deleted');
  }

  await prisma.queue.updateMany({
    where: {
      gpu_ids: job.gpu_ids,
      is_running: true,
    },
    data: {
      is_running: false,
    },
  });

  const [trainingRoot, inferenceRoot] = await Promise.all([getTrainingRoot(), getInferenceRoot()]);
  const safeArtifactRoot = ensurePathInsideRoots(resolveArtifactRootForDeletion(job.artifact_root), [trainingRoot, inferenceRoot]);
  if (fs.existsSync(safeArtifactRoot)) {
    fs.rmSync(safeArtifactRoot, { recursive: true, force: true });
  }

  return prisma.$transaction(async tx => {
    const deletedJob = await tx.job.delete({
      where: { id: jobId },
    });

    if (deletedJob.job_type === 'train') {
      const remainingActiveTrainJobs = await tx.job.count({
        where: {
          job_type: 'train',
          gpu_ids: deletedJob.gpu_ids,
          status: { in: ACTIVE_TRAIN_QUEUE_STATUSES },
        },
      });

      if (remainingActiveTrainJobs > 0) {
        await tx.queue.upsert({
          where: { gpu_ids: deletedJob.gpu_ids },
          update: { is_running: true },
          create: { gpu_ids: deletedJob.gpu_ids, is_running: true },
        });
      } else {
        await tx.queue.updateMany({
          where: { gpu_ids: deletedJob.gpu_ids },
          data: { is_running: false },
        });
      }
    }

    return deletedJob;
  });
}
