import { NextResponse } from 'next/server';
import { readJobLog } from '@/server/jobs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const offset = Number(searchParams.get('offset') || '0');
  try {
    return NextResponse.json(await readJobLog(id, offset));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to read log' }, { status: 500 });
  }
}
