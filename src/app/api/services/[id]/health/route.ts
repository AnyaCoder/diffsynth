import { NextResponse } from 'next/server';
import { getInferenceServiceHealth } from '@/server/inferenceServices';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const health = await getInferenceServiceHealth(id);
  if (!health) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  }
  return NextResponse.json(health);
}
