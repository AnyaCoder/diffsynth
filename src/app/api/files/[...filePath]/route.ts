import { NextResponse } from 'next/server';
import fs from 'fs';
import { getDatasetsRoot, getInferenceRoot, getTrainingRoot } from '@/server/settings';
import { ensureInsideRoots } from '@/server/security';

export async function GET(_: Request, { params }: { params: Promise<{ filePath: string[] }> }) {
  const { filePath } = await params;
  const encoded = filePath.join('/');
  const decoded = decodeURIComponent(encoded);
  const [datasetsRoot, trainingRoot, inferenceRoot] = await Promise.all([
    getDatasetsRoot(),
    getTrainingRoot(),
    getInferenceRoot(),
  ]);
  const safePath = ensureInsideRoots(decoded, [datasetsRoot, trainingRoot, inferenceRoot]);
  if (!fs.existsSync(safePath)) {
    return new NextResponse('Not found', { status: 404 });
  }
  return new NextResponse(fs.readFileSync(safePath));
}
