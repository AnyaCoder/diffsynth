import { NextResponse } from 'next/server';
import { createDataset } from '@/server/datasets';
import { recordAuditEvent } from '@/server/audit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const datasetPath = await createDataset(body.name);
    await recordAuditEvent(request, {
      action: 'dataset.create',
      outcome: 'success',
      resourceId: String(body.name || ''),
      resourceType: 'dataset',
      statusCode: 200,
      detail: { path: datasetPath },
    });
    return NextResponse.json({ success: true, path: datasetPath });
  } catch (error: any) {
    await recordAuditEvent(request, {
      action: 'dataset.create',
      outcome: 'error',
      resourceType: 'dataset',
      statusCode: 400,
      detail: { error: error?.message || 'Failed to create dataset' },
    });
    return NextResponse.json({ error: error?.message || 'Failed to create dataset' }, { status: 400 });
  }
}
