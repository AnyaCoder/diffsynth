import { NextResponse } from 'next/server';
import { listDatasetItems } from '@/server/datasets';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const datasetName = searchParams.get('datasetName');
  if (!datasetName) {
    return NextResponse.json({ error: 'datasetName is required' }, { status: 400 });
  }
  return NextResponse.json({ items: await listDatasetItems(datasetName) });
}
