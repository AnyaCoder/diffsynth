import NodeCache from 'node-cache';
import prisma from './prisma';
import { DEFAULT_CONDA_ENV_NAME, DEFAULT_DATASETS_ROOT, DEFAULT_INFERENCE_ROOT, DEFAULT_TRAINING_ROOT } from '../paths';

const cache = new NodeCache();

export const flushCache = () => {
  cache.flushAll();
};

async function getSetting(key: string, fallback: string) {
  const cached = cache.get<string>(key);
  if (cached) return cached;
  const row = await prisma.settings.findFirst({ where: { key } });
  const value = row?.value?.trim() ? row.value : fallback;
  cache.set(key, value);
  return value;
}

export async function getDatasetsRoot() {
  return getSetting('DATASETS_ROOT', DEFAULT_DATASETS_ROOT);
}

export async function getTrainingRoot() {
  return getSetting('TRAINING_ROOT', DEFAULT_TRAINING_ROOT);
}

export async function getInferenceRoot() {
  return getSetting('INFERENCE_ROOT', DEFAULT_INFERENCE_ROOT);
}

export async function getCondaEnvName() {
  return getSetting('CONDA_ENV_NAME', DEFAULT_CONDA_ENV_NAME);
}

export async function getSettingsObject() {
  return {
    DATASETS_ROOT: await getDatasetsRoot(),
    TRAINING_ROOT: await getTrainingRoot(),
    INFERENCE_ROOT: await getInferenceRoot(),
    CONDA_ENV_NAME: await getCondaEnvName(),
  };
}
