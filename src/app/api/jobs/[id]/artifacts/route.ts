import { NextResponse } from 'next/server';
import { listArtifacts } from '@/server/jobs';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ artifacts: await listArtifacts(id) });
}
