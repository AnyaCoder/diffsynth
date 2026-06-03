import { NextResponse } from 'next/server';
import { archiveJob, unarchiveJob } from '@/server/jobMutations';
import { recordAuditEvent } from '@/server/audit';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const archived = body?.archived !== false;
    const job = archived ? await archiveJob(id) : await unarchiveJob(id);
    await recordAuditEvent(request, {
      action: archived ? 'job.archive' : 'job.unarchive',
      outcome: 'success',
      resourceId: id,
      resourceType: 'job',
      statusCode: 200,
      detail: { name: job.name, archived },
    });
    return NextResponse.json({ success: true, job });
  } catch (error: any) {
    const statusCode = error?.message === 'Job not found' ? 404 : 400;
    await recordAuditEvent(request, {
      action: 'job.archive',
      outcome: 'error',
      resourceId: id,
      resourceType: 'job',
      statusCode,
      detail: { error: error?.message || 'Failed to archive job' },
    });
    return NextResponse.json({ error: error?.message || 'Failed to archive job' }, { status: statusCode });
  }
}
