import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDatasetPath, rebuildMetadataCsv, sanitizeRelativeDatasetPath } from '@/server/datasets';
import { recordAuditEvent } from '@/server/audit';
import { ensurePathInsideRoots } from '@/server/security';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const datasetName = String(formData.get('datasetName') || '');
    const files = formData.getAll('files') as File[];
    const relativePaths = formData.getAll('relativePaths').map(value => String(value));
    const datasetPath = await getDatasetPath(datasetName);
    fs.mkdirSync(datasetPath, { recursive: true });

    for (const [index, file] of files.entries()) {
      const relativePath = sanitizeRelativeDatasetPath(relativePaths[index] || file.name);
      const target = ensurePathInsideRoots(path.join(datasetPath, relativePath), [datasetPath]);
      if (fs.existsSync(target)) {
        await recordAuditEvent(request, {
          action: 'dataset.upload',
          outcome: 'error',
          resourceId: datasetName,
          resourceType: 'dataset',
          statusCode: 409,
          detail: { error: `File already exists: ${relativePath}`, file_count: files.length },
        });
        return NextResponse.json({ error: `File already exists: ${relativePath}` }, { status: 409 });
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const bytes = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(target, bytes);
    }
    await rebuildMetadataCsv(datasetName);
    await recordAuditEvent(request, {
      action: 'dataset.upload',
      outcome: 'success',
      resourceId: datasetName,
      resourceType: 'dataset',
      statusCode: 200,
      detail: { file_count: files.length },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await recordAuditEvent(request, {
      action: 'dataset.upload',
      outcome: 'error',
      resourceType: 'dataset',
      statusCode: 500,
      detail: { error: error?.message || 'Failed to upload files' },
    });
    return NextResponse.json({ error: error?.message || 'Failed to upload files' }, { status: 500 });
  }
}
