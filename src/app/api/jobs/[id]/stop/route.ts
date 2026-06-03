import { NextResponse } from 'next/server';
import prisma from '@/server/prisma';
import { requestStopJob } from '@/server/jobLifecycle';
import { recordAuditEvent } from '@/server/audit';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    await recordAuditEvent(request, {
      action: 'job.stop',
      outcome: 'error',
      resourceId: id,
      resourceType: 'job',
      statusCode: 404,
      detail: { error: 'Job not found' },
    });
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  try {
    await requestStopJob(id);
    await recordAuditEvent(request, {
      action: 'job.stop',
      outcome: 'success',
      resourceId: id,
      resourceType: 'job',
      statusCode: 200,
      detail: { job_type: job.job_type, name: job.name },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await recordAuditEvent(request, {
      action: 'job.stop',
      outcome: 'error',
      resourceId: id,
      resourceType: 'job',
      statusCode: 500,
      detail: { error: error?.message || 'Failed to stop job', job_type: job.job_type, name: job.name },
    });
    return NextResponse.json({ error: error?.message || 'Failed to stop job' }, { status: 500 });
  }
}
