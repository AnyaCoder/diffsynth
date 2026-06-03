import path from 'path';
import fs from 'fs';

export const UI_ROOT = path.resolve(process.cwd());
export const REPO_ROOT = path.resolve(UI_ROOT, '..');
export const PYTHON_ROOT = path.join(UI_ROOT, 'python');
export const DB_PATH = path.join(UI_ROOT, 'qwen_ui.db');

export const DEFAULT_DATASETS_ROOT = path.join(REPO_ROOT, 'data', 'user_datasets', 'qwen_image');
export const DEFAULT_TRAINING_ROOT = path.join(REPO_ROOT, 'models', 'train');
export const DEFAULT_INFERENCE_ROOT = path.join(REPO_ROOT, 'outputs', 'qwen_image');
export const DEFAULT_CONDA_ENV_NAME = 'trainer';

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}
