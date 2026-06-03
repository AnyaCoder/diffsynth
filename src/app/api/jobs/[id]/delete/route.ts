import { NextResponse } from 'next/server';
import { deleteJobRecord } from '@/server/jobMutations';
import { recordAuditEvent } from '@/server/audit';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const job = await deleteJobRecord(id);
    await recordAuditEvent(request, {
      action: 'job.delete',
      outcome: 'success',
      resourceId: id,
      resourceType: 'job',
      statusCode: 200,
      detail: { name: job.name, artifact_root: job.artifact_root, destructive: true },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const statusCode = error?.message === 'Job not found' ? 404 : 400;
    await recordAuditEvent(request, {
      action: 'job.delete',
      outcome: 'error',
      resourceId: id,
      resourceType: 'job',
      statusCode,
      detail: { error: error?.message || 'Failed to delete job' },
    });
    return NextResponse.json({ error: error?.message || 'Failed to delete job' }, { status: statusCode });
  }
}
