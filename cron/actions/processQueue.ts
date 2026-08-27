import prisma from '../prisma';
import { Job, Queue } from '@prisma/client';
import startJob from './startJob';
import { processQueuedInferenceServices } from '../../src/server/inferenceServices';
import { isGpuBusy } from '../../src/server/process';
import { reconcileStaleStoppingJobs } from '../../src/server/jobLifecycle';
import { processQueuedAlgorithmJobs } from '../../src/server/algorithmApi';

export default async function processQueue() {
  await reconcileStaleStoppingJobs();

  const queues: Queue[] = await prisma.queue.findMany({ orderBy: { id: 'asc' } });
  const activeServices = await prisma.inferenceService.findMany({
    where: {
      status: { in: ['starting', 'running', 'stopping'] },
    },
    select: { gpu_ids: true },
  });

  for (const queue of queues) {
    if (!queue.is_running) continue;

    const runningJob: Job | null = await prisma.job.findFirst({
      where: {
        job_type: 'train',
        status: { in: ['running', 'stopping'] },
        gpu_ids: queue.gpu_ids,
      },
    });

    if (runningJob) {
      continue;
    }

    if (isGpuBusy(queue.gpu_ids, activeServices.map(service => service.gpu_ids))) {
      continue;
    }

    const nextJob: Job | null = await prisma.job.findFirst({
      where: {
        job_type: 'train',
        status: 'queued',
        gpu_ids: queue.gpu_ids,
      },
      orderBy: { queue_position: 'asc' },
    });

    if (!nextJob) {
      await prisma.queue.update({
        where: { id: queue.id },
        data: { is_running: false },
      });
      continue;
    }

    await startJob(nextJob.id);
  }

  await processQueuedInferenceServices();
  await processQueuedAlgorithmJobs();
}
