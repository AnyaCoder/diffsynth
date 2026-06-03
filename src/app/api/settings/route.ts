import { NextResponse } from 'next/server';
import prisma from '@/server/prisma';
import { DEFAULT_CONDA_ENV_NAME, DEFAULT_DATASETS_ROOT, DEFAULT_INFERENCE_ROOT, DEFAULT_TRAINING_ROOT } from '@/paths';
import { recordAuditEvent } from '@/server/audit';
import { flushCache, getSettingsObject } from '@/server/settings';

export async function GET() {
  try {
    return NextResponse.json(await getSettingsObject());
  } catch {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entries = [
      ['DATASETS_ROOT', body.DATASETS_ROOT || DEFAULT_DATASETS_ROOT],
      ['TRAINING_ROOT', body.TRAINING_ROOT || DEFAULT_TRAINING_ROOT],
      ['INFERENCE_ROOT', body.INFERENCE_ROOT || DEFAULT_INFERENCE_ROOT],
      ['CONDA_ENV_NAME', body.CONDA_ENV_NAME || DEFAULT_CONDA_ENV_NAME],
    ] as const;

    await Promise.all(
      entries.map(([key, value]) =>
        prisma.settings.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        }),
      ),
    );

    flushCache();
    await recordAuditEvent(request, {
      action: 'settings.update',
      outcome: 'success',
      resourceType: 'settings',
      statusCode: 200,
      detail: Object.fromEntries(entries),
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await recordAuditEvent(request, {
      action: 'settings.update',
      outcome: 'error',
      resourceType: 'settings',
      statusCode: 500,
      detail: { error: error?.message || 'Failed to update settings' },
    });
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
