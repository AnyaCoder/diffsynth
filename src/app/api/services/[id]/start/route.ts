import { NextResponse } from 'next/server';
import { queueInferenceService } from '@/server/inferenceServices';
import { recordAuditEvent } from '@/server/audit';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const service = await queueInferenceService(id);
    if (!service) {
      await recordAuditEvent(request, {
        action: 'service.start',
        outcome: 'error',
        resourceId: id,
        resourceType: 'service',
        statusCode: 404,
        detail: { error: 'Service not found' },
      });
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }
    await recordAuditEvent(request, {
      action: 'service.start',
      outcome: 'success',
      resourceId: id,
      resourceType: 'service',
      statusCode: 200,
      detail: { name: service.name },
    });
    return NextResponse.json(service);
  } catch (error: any) {
    await recordAuditEvent(request, {
      action: 'service.start',
      outcome: 'error',
      resourceId: id,
      resourceType: 'service',
      statusCode: 400,
      detail: { error: error?.message || 'Failed to start service' },
    });
    return NextResponse.json({ error: error?.message || 'Failed to start service' }, { status: 400 });
  }
}
