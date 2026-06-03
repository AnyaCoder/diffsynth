import { NextResponse } from 'next/server';
import { readServiceLog } from '@/server/inferenceServices';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const offset = Number(searchParams.get('offset') || '0');
  try {
    return NextResponse.json(await readServiceLog(id, offset));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to read service log' }, { status: 500 });
  }
}
