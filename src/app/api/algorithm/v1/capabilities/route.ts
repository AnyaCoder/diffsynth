import { getAlgorithmCapabilities } from '@/server/algorithmApi';
import { algorithmError, algorithmJson, algorithmOptions } from '../http';

export async function GET(request: Request) {
  try {
    return algorithmJson(request, await getAlgorithmCapabilities());
  } catch (error) {
    return algorithmError(request, error);
  }
}

export async function OPTIONS(request: Request) {
  return algorithmOptions(request);
}
