import fs from 'fs';
import os from 'os';
import path from 'path';

function firstExistingPath(candidates: Array<string | undefined>) {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!candidate.includes(path.sep)) return candidate;
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function resolvePythonPath() {
  return 'python';
}

export function resolveCondaPath() {
  return (
    firstExistingPath([
      process.env.CONDA_EXE,
      '/newdisk/miniconda3/bin/conda',
      '/opt/conda/bin/conda',
      '/usr/local/miniconda3/bin/conda',
      path.join(os.homedir(), 'miniconda3', 'bin', 'conda'),
      path.join(os.homedir(), 'anaconda3', 'bin', 'conda'),
      'conda',
    ]) ?? 'conda'
  );
}
