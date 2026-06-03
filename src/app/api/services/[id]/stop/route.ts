import { NextResponse } from 'next/server';
import { stopInferenceService } from '@/server/inferenceServices';
import { recordAuditEvent } from '@/server/audit';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const service = await stopInferenceService(id);
    await recordAuditEvent(request, {
      action: 'service.stop',
      outcome: 'success',
      resourceId: id,
      resourceType: 'service',
      statusCode: 200,
      detail: { name: service?.name || null },
    });
    return NextResponse.json(service);
  } catch (error: any) {
    await recordAuditEvent(request, {
      action: 'service.stop',
      outcome: 'error',
      resourceId: id,
      resourceType: 'service',
      statusCode: 400,
      detail: { error: error?.message || 'Failed to stop service' },
    });
    return NextResponse.json({ error: error?.message || 'Failed to stop service' }, { status: 400 });
  }
}
