import { NextResponse } from 'next/server';
import prisma from '@/server/prisma';

export async function GET() {
  const queues = await prisma.queue.findMany({ orderBy: { gpu_ids: 'asc' } });
  return NextResponse.json({ queues });
}
