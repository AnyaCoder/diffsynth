import { getTextToImageBatchResults } from '@/server/algorithmApi';
import { algorithmError, algorithmJson, algorithmOptions } from '../../../http';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = await getTextToImageBatchResults(id);
    return algorithmJson(request, {
      ...payload,
      results: payload.results.map(result => ({
        ...result,
        image_url: new URL(result.image_url, request.url).toString(),
      })),
    });
  } catch (error) {
    return algorithmError(request, error);
  }
}

export async function OPTIONS(request: Request) {
  return algorithmOptions(request);
}
