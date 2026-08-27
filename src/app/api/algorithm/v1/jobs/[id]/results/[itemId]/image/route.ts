import fs from 'fs';
import path from 'path';
import { getTextToImageResultFile } from '@/server/algorithmApi';
import { algorithmError, algorithmOptions } from '../../../../../http';
import { getAlgorithmCorsHeaders } from '@/domain/algorithmApiCors';
import { getInferenceRoot } from '@/server/settings';
import { ensureInsideRoots } from '@/server/security';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const { id, itemId } = await params;
    const imagePath = await getTextToImageResultFile(id, itemId);
    const safePath = ensureInsideRoots(imagePath, [await getInferenceRoot()]);
    const headers = new Headers(getAlgorithmCorsHeaders(request.headers.get('origin')));
    headers.set('Cache-Control', 'private, max-age=3600');
    headers.set('Content-Disposition', `inline; filename="${path.basename(safePath).replace(/"/g, '')}"`);
    headers.set('Content-Type', imageContentType(safePath));
    return new Response(fs.readFileSync(safePath), { status: 200, headers });
  } catch (error) {
    return algorithmError(request, error);
  }
}

export async function OPTIONS(request: Request) {
  return algorithmOptions(request);
}

function imageContentType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  return 'image/jpeg';
}
