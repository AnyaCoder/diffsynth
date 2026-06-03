import { NextResponse } from 'next/server';
import { createInferenceServiceFromRequest, listInferenceServices } from '@/server/inferenceServices';
import { recordAuditEvent } from '@/server/audit';

export async function GET() {
  const services = await listInferenceServices();
  return NextResponse.json({ services });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const service = await createInferenceServiceFromRequest(body);
    await recordAuditEvent(request, {
      action: 'service.create',
      outcome: 'success',
      resourceId: service.id,
      resourceType: 'service',
      statusCode: 200,
      detail: { name: service.name, gpu_ids: service.gpu_ids, use_lora: service.use_lora },
    });
    return NextResponse.json(service);
  } catch (error: any) {
    await recordAuditEvent(request, {
      action: 'service.create',
      outcome: 'error',
      resourceType: 'service',
      statusCode: 400,
      detail: { error: error?.message || 'Failed to create service' },
    });
    return NextResponse.json({ error: error?.message || 'Failed to create service' }, { status: 400 });
  }
}
