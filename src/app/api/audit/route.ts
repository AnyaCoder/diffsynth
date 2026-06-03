import { NextResponse } from 'next/server';
import prisma from '@/server/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get('limit') || '100');
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(500, rawLimit)) : 100;
  const logs = await prisma.auditLog.findMany({
    orderBy: { created_at: 'desc' },
    take: limit,
  });
  return NextResponse.json({
    logs: logs.map(log => ({
      ...log,
      detail: log.detail_json ? JSON.parse(log.detail_json) : null,
    })),
  });
}
