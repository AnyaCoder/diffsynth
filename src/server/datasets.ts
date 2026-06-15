import fs from 'fs';
import path from 'path';
import { DatasetItem } from '../types';
import { getDatasetsRoot } from './settings';
import { ensurePathExists, ensurePathInsideRoots, sanitizeDatasetName, sanitizeFileName } from './security';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function captionPathForImage(imagePath: string) {
  const ext = path.extname(imagePath);
  return imagePath.slice(0, -ext.length) + '.txt';
}

function metadataPathForDataset(datasetPath: string) {
  return path.join(datasetPath, 'metadata.csv');
}

export async function getDatasetPath(datasetName: string) {
  const root = await getDatasetsRoot();
  ensurePathExists(root);
  return path.join(root, sanitizeDatasetName(datasetName));
}

export async function listDatasets() {
  const root = await getDatasetsRoot();
  ensurePathExists(root);
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => entry.name)
    .sort();
}

export async function createDataset(datasetName: string) {
  const datasetPath = await getDatasetPath(datasetName);
  if (fs.existsSync(datasetPath)) {
    throw new Error('Dataset already exists');
  }
  fs.mkdirSync(datasetPath, { recursive: true });
  return datasetPath;
}

export async function deleteDataset(datasetName: string) {
  const datasetPath = await getDatasetPath(datasetName);
  if (fs.existsSync(datasetPath)) {
    fs.rmSync(datasetPath, { recursive: true, force: true });
  }
}

export async function deleteDatasetItem(datasetName: string, relativePathInput: string) {
  const datasetPath = await getDatasetPath(datasetName);
  ensurePathExists(datasetPath);
  const relativePath = sanitizeRelativeDatasetPath(relativePathInput);
  const imagePath = ensurePathInsideRoots(path.join(datasetPath, relativePath), [datasetPath]);
  const ext = path.extname(imagePath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) {
    throw new Error('Only image files can be deleted from a dataset');
  }
  if (!fs.existsSync(imagePath)) {
    throw new Error('Dataset image not found');
  }
  fs.rmSync(imagePath, { force: true });
  const captionPath = ensurePathInsideRoots(captionPathForImage(imagePath), [datasetPath]);
  if (fs.existsSync(captionPath)) {
    fs.rmSync(captionPath, { force: true });
  }
  await rebuildMetadataCsv(datasetName);
}

export async function listDatasetItems(datasetName: string): Promise<DatasetItem[]> {
  const datasetPath = await getDatasetPath(datasetName);
  ensurePathExists(datasetPath);
  const imagePaths = collectImagePaths(datasetPath).sort((left, right) => left.localeCompare(right));
  return imagePaths.map(relativePath => {
    const imagePath = path.join(datasetPath, relativePath);
    const captionPath = captionPathForImage(imagePath);
    const caption = fs.existsSync(captionPath) ? fs.readFileSync(captionPath, 'utf-8') : '';
    const segments = relativePath.split(path.sep).map(segment => encodeURIComponent(segment));
    return {
      file_name: path.basename(relativePath),
      relative_path: relativePath,
      caption,
      has_caption: caption.trim().length > 0,
      thumb_url: `/api/images/${encodeURIComponent(datasetName)}/${segments.join('/')}`,
    };
  });
}

export async function saveCaptions(datasetName: string, items: Array<{ file_name: string; relative_path?: string; caption: string }>) {
  const datasetPath = await getDatasetPath(datasetName);
  ensurePathExists(datasetPath);
  for (const item of items) {
    const relativePath = sanitizeRelativeDatasetPath(item.relative_path || item.file_name);
    const imagePath = path.join(datasetPath, relativePath);
    if (!fs.existsSync(imagePath)) continue;
    const txtPath = captionPathForImage(imagePath);
    fs.mkdirSync(path.dirname(txtPath), { recursive: true });
    fs.writeFileSync(txtPath, item.caption ?? '', 'utf-8');
  }
  await rebuildMetadataCsv(datasetName);
}

export async function rebuildMetadataCsv(datasetName: string) {
  const datasetPath = await getDatasetPath(datasetName);
  const items = await listDatasetItems(datasetName);
  const rows = ['image,prompt'];
  for (const item of items) {
    if (!item.has_caption) continue;
    const escaped = JSON.stringify(item.caption);
    rows.push(`${item.relative_path.split(path.sep).join('/')},${escaped}`);
  }
  fs.writeFileSync(metadataPathForDataset(datasetPath), `${rows.join('\n')}\n`, 'utf-8');
  return metadataPathForDataset(datasetPath);
}

export async function metadataPath(datasetName: string) {
  return metadataPathForDataset(await getDatasetPath(datasetName));
}

function collectImagePaths(root: string, current = ''): string[] {
  const dir = current ? path.join(root, current) : root;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const paths: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const relativePath = current ? path.join(current, entry.name) : entry.name;
    if (entry.isDirectory()) {
      paths.push(...collectImagePaths(root, relativePath));
      continue;
    }
    if (!IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    paths.push(relativePath);
  }
  return paths;
}

export function sanitizeRelativeDatasetPath(input: string) {
  const normalized = input.split('\\').join('/');
  const segments = normalized
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean)
    .map(sanitizeFileName);
  if (segments.length === 0) {
    throw new Error('Invalid relative file path');
  }
  return segments.join(path.sep);
}
