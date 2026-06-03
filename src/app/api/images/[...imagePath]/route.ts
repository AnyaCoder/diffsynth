import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDatasetsRoot } from '@/server/settings';
import { ensureInsideRoots } from '@/server/security';

export async function GET(_: Request, { params }: { params: Promise<{ imagePath: string[] }> }) {
  const { imagePath } = await params;
  const datasetsRoot = await getDatasetsRoot();
  const decoded = imagePath.map(item => decodeURIComponent(item));
  const target = path.join(datasetsRoot, ...decoded);
  const safePath = ensureInsideRoots(target, [datasetsRoot]);
  if (!fs.existsSync(safePath)) {
    return new NextResponse('Not found', { status: 404 });
  }
  const ext = path.extname(safePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return new NextResponse(fs.readFileSync(safePath), {
    headers: { 'Content-Type': mime },
  });
}
