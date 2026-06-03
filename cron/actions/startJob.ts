import { startJobNow } from '../../src/server/jobLifecycle';

export default async function startJob(jobId: string) {
  await startJobNow(jobId);
}
