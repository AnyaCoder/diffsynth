import { NextResponse } from 'next/server';
import { proxyGenerateInferenceService } from '@/server/inferenceServices';
import { recordAuditEvent } from '@/server/audit';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const payload = await request.json();
    const result = await proxyGenerateInferenceService(id, payload);
    await recordAuditEvent(request, {
      action: 'service.generate',
      outcome: 'success',
      resourceId: id,
      resourceType: 'service',
      statusCode: 200,
      detail: {
        prompt: typeof payload?.prompt === 'string' ? payload.prompt.slice(0, 200) : null,
        output_path: result?.output_path ?? null,
      },
    });
    return NextResponse.json(result);
  } catch (error: any) {
    await recordAuditEvent(request, {
      action: 'service.generate',
      outcome: 'error',
      resourceId: id,
      resourceType: 'service',
      statusCode: 400,
      detail: { error: error?.message || 'Failed to generate via service' },
    });
    return NextResponse.json({ error: error?.message || 'Failed to generate via service' }, { status: 400 });
  }
}
