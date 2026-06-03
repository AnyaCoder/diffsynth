import { NextResponse } from 'next/server';
import { deleteDataset } from '@/server/datasets';
import { recordAuditEvent } from '@/server/audit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await deleteDataset(body.name);
    await recordAuditEvent(request, {
      action: 'dataset.delete',
      outcome: 'success',
      resourceId: String(body.name || ''),
      resourceType: 'dataset',
      statusCode: 200,
      detail: null,
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await recordAuditEvent(request, {
      action: 'dataset.delete',
      outcome: 'error',
      resourceType: 'dataset',
      statusCode: 400,
      detail: { error: error?.message || 'Failed to delete dataset' },
    });
    return NextResponse.json({ error: error?.message || 'Failed to delete dataset' }, { status: 400 });
  }
}
