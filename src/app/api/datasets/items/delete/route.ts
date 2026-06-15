import { NextResponse } from 'next/server';
import { recordAuditEvent } from '@/server/audit';
import { deleteDatasetItem } from '@/server/datasets';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const datasetName = String(body.datasetName || '');
    const relativePath = String(body.relativePath || '');
    await deleteDatasetItem(datasetName, relativePath);
    await recordAuditEvent(request, {
      action: 'dataset.item.delete',
      outcome: 'success',
      resourceId: datasetName,
      resourceType: 'dataset',
      statusCode: 200,
      detail: { relative_path: relativePath },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await recordAuditEvent(request, {
      action: 'dataset.item.delete',
      outcome: 'error',
      resourceType: 'dataset',
      statusCode: 400,
      detail: { error: error?.message || 'Failed to delete dataset image' },
    });
    return NextResponse.json({ error: error?.message || 'Failed to delete dataset image' }, { status: 400 });
  }
}
