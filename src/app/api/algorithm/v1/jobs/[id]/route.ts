import { getTextToImageBatch } from '@/server/algorithmApi';
import { algorithmError, algorithmJson, algorithmOptions } from '../../http';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return algorithmJson(request, await getTextToImageBatch(id));
  } catch (error) {
    return algorithmError(request, error);
  }
}

export async function OPTIONS(request: Request) {
  return algorithmOptions(request);
}
