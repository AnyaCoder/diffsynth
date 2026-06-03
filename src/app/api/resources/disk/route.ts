import { NextResponse } from 'next/server';
import fs from 'fs';
import { getDatasetsRoot, getInferenceRoot, getTrainingRoot } from '@/server/settings';
import { DiskInfo } from '@/types';

export async function GET() {
  try {
    const [datasetsRoot, trainingRoot, inferenceRoot] = await Promise.all([
      getDatasetsRoot(),
      getTrainingRoot(),
      getInferenceRoot(),
    ]);
    const stat = fs.statfsSync(trainingRoot);
    const payload: DiskInfo = {
      datasetsRoot,
      trainingRoot,
      inferenceRoot,
      freeBytes: stat.bavail * stat.bsize,
      totalBytes: stat.blocks * stat.bsize,
    };
    return NextResponse.json(payload);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to read disk info' }, { status: 500 });
  }
}
