import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getInferenceRoot } from './settings';
import { ensureInsideRoots, ensurePathInsideRoots } from './security';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_ASSET_BYTES = 100 * 1024 * 1024;

export function normalizeInferenceControlMode(value: unknown) {
  return value === 'inpaint' ? 'inpaint' : 'none';
}

export function validateInferenceAssetPath(candidatePath: string, inferenceRoot: string) {
  const normalized = ensureInsideRoots(candidatePath, [inferenceRoot]);
  const extension = path.extname(normalized).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported inference asset type: ${extension || 'unknown'}`);
  }
  const stat = fs.statSync(normalized);
  if (!stat.isFile()) {
    throw new Error(`Inference asset is not a file: ${normalized}`);
  }
  if (stat.size > MAX_ASSET_BYTES) {
    throw new Error(`Inference asset is too large: ${normalized}`);
  }
  return normalized;
}

export async function saveInferenceAssets(inputImage: File | null, inpaintMask: File | null) {
  if (!inputImage || !inpaintMask) {
    throw new Error('Both a control image and an inpaint mask are required');
  }
  const inferenceRoot = await getInferenceRoot();
  fs.mkdirSync(inferenceRoot, { recursive: true });
  const assetRoot = ensurePathInsideRoots(path.join(inferenceRoot, 'assets', crypto.randomUUID()), [inferenceRoot]);
  fs.mkdirSync(assetRoot, { recursive: true });

  try {
    const inputPath = await writeUploadedImage(inputImage, assetRoot, 'input');
    const maskPath = await writeUploadedImage(inpaintMask, assetRoot, 'mask');
    return {
      input_image_path: validateInferenceAssetPath(inputPath, inferenceRoot),
      inpaint_mask_path: validateInferenceAssetPath(maskPath, inferenceRoot),
    };
  } catch (error) {
    fs.rmSync(assetRoot, { recursive: true, force: true });
    throw error;
  }
}

async function writeUploadedImage(file: File, assetRoot: string, prefix: string) {
  const extension = path.extname(file.name).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported upload type for ${prefix}: ${extension || 'unknown'}`);
  }
  if (file.size <= 0 || file.size > MAX_ASSET_BYTES) {
    throw new Error(`Invalid upload size for ${prefix}`);
  }
  const target = ensurePathInsideRoots(path.join(assetRoot, `${prefix}${extension}`), [assetRoot]);
  fs.writeFileSync(target, Buffer.from(await file.arrayBuffer()));
  return target;
}
