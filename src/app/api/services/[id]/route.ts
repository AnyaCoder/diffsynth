import { NextResponse } from 'next/server';
import { deleteInferenceService, getInferenceService } from '@/server/inferenceServices';
import { recordAuditEvent } from '@/server/audit';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = await getInferenceService(id);
  return NextResponse.json(service);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const service = await deleteInferenceService(id);
    await recordAuditEvent(request, {
      action: 'service.delete',
      outcome: 'success',
      resourceId: id,
      resourceType: 'service',
      statusCode: 200,
      detail: { name: service?.name || null },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await recordAuditEvent(request, {
      action: 'service.delete',
      outcome: 'error',
      resourceId: id,
      resourceType: 'service',
      statusCode: 400,
      detail: { error: error?.message || 'Failed to delete service' },
    });
    return NextResponse.json({ error: error?.message || 'Failed to delete service' }, { status: 400 });
  }
}
