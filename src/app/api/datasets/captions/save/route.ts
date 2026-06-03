import { NextResponse } from 'next/server';
import { saveCaptions } from '@/server/datasets';
import { recordAuditEvent } from '@/server/audit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await saveCaptions(body.datasetName, body.items || []);
    await recordAuditEvent(request, {
      action: 'dataset.captions.save',
      outcome: 'success',
      resourceId: String(body.datasetName || ''),
      resourceType: 'dataset',
      statusCode: 200,
      detail: { item_count: Array.isArray(body.items) ? body.items.length : 0 },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await recordAuditEvent(request, {
      action: 'dataset.captions.save',
      outcome: 'error',
      resourceType: 'dataset',
      statusCode: 500,
      detail: { error: error?.message || 'Failed to save captions' },
    });
    return NextResponse.json({ error: error?.message || 'Failed to save captions' }, { status: 500 });
  }
}
