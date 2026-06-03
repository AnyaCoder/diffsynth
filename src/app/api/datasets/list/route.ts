import { NextResponse } from 'next/server';
import { listDatasets } from '@/server/datasets';

export async function GET() {
  return NextResponse.json({ datasets: await listDatasets() });
}
