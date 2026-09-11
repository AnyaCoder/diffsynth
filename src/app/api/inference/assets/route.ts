import { NextResponse } from 'next/server';
import { recordAuditEvent } from '@/server/audit';
import { saveInferenceAssets } from '@/server/inferenceAssets';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const inputImage = formData.get('inputImage');
    const inpaintMask = formData.get('inpaintMask');
    const assets = await saveInferenceAssets(
      inputImage instanceof File ? inputImage : null,
      inpaintMask instanceof File ? inpaintMask : null,
    );
    await recordAuditEvent(request, {
      action: 'inference.asset.upload',
      outcome: 'success',
      resourceType: 'inference_asset',
      statusCode: 200,
      detail: { input_image_path: assets.input_image_path, inpaint_mask_path: assets.inpaint_mask_path },
    });
    return NextResponse.json(assets);
  } catch (error: any) {
    await recordAuditEvent(request, {
      action: 'inference.asset.upload',
      outcome: 'error',
      resourceType: 'inference_asset',
      statusCode: 400,
      detail: { error: error?.message || 'Failed to upload inference assets' },
    });
    return NextResponse.json({ error: error?.message || 'Failed to upload inference assets' }, { status: 400 });
  }
}
