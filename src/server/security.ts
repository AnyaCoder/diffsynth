import fs from 'fs';
import path from 'path';

export function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function sanitizeDatasetName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

export function ensureInsideRoots(candidatePath: string, roots: string[]) {
  const normalized = fs.realpathSync(candidatePath);
  const allowed = roots.map(root => fs.realpathSync(root));
  const ok = allowed.some(root => normalized === root || normalized.startsWith(`${root}${path.sep}`));
  if (!ok) {
    throw new Error(`Path not allowed: ${candidatePath}`);
  }
  return normalized;
}

export function ensurePathInsideRoots(candidatePath: string, roots: string[]) {
  const normalized = path.resolve(candidatePath);
  const allowed = roots.map(root => fs.realpathSync(root));
  const ok = allowed.some(root => normalized === root || normalized.startsWith(`${root}${path.sep}`));
  if (!ok) {
    throw new Error(`Path not allowed: ${candidatePath}`);
  }
  return normalized;
}

export function ensurePathExists(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
