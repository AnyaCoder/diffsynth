import { NextResponse } from 'next/server';
import prisma from '@/server/prisma';
import { createJobFromRequest, JobIntakeError } from '@/server/jobIntake';
import { recordAuditEvent } from '@/server/audit';
import { listRecentInferenceResults } from '@/server/jobs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const jobType = searchParams.get('job_type');
  const includeArchived = searchParams.get('include_archived') === 'true';
  const recentInferResults = searchParams.get('recent_infer_results') === 'true';
  const limit = Number(searchParams.get('limit') || '18');
  if (id) {
    const job = await prisma.job.findUnique({ where: { id } });
    return NextResponse.json(job);
  }
  if (recentInferResults) {
    return NextResponse.json({ results: await listRecentInferenceResults(limit) });
  }
  const jobs = await prisma.job.findMany({
    where: {
      ...(jobType ? { job_type: jobType } : {}),
      ...(includeArchived ? {} : { is_archived: false }),
    },
    orderBy: { created_at: 'desc' },
  });
  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const job = await createJobFromRequest(body);
    await recordAuditEvent(request, {
      action: 'job.create',
      outcome: 'success',
      resourceId: job.id,
      resourceType: 'job',
      statusCode: 200,
      detail: { job_type: job.job_type, name: job.name, gpu_ids: job.gpu_ids },
    });
    return NextResponse.json(job);
  } catch (error: any) {
    if (error?.code === 'P2002') {
      await recordAuditEvent(request, {
        action: 'job.create',
        outcome: 'error',
        resourceType: 'job',
        statusCode: 409,
        detail: { error: 'Job name already exists' },
      });
      return NextResponse.json({ error: 'Job name already exists' }, { status: 409 });
    }
    if (error instanceof JobIntakeError) {
      await recordAuditEvent(request, {
        action: 'job.create',
        outcome: 'error',
        resourceType: 'job',
        statusCode: error.status,
        detail: { error: error.message },
      });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    await recordAuditEvent(request, {
      action: 'job.create',
      outcome: 'error',
      resourceType: 'job',
      statusCode: 500,
      detail: { error: error?.message || 'Failed to create job' },
    });
    return NextResponse.json({ error: error?.message || 'Failed to create job' }, { status: 500 });
  }
}
