import { createTextToImageBatch, AlgorithmApiError } from '@/server/algorithmApi';
import { algorithmError, algorithmJson, algorithmOptions } from '../../http';
import { recordAuditEvent } from '@/server/audit';

export async function POST(request: Request) {
  try {
    const batch = await createTextToImageBatch(await request.json());
    await recordAuditEvent(request, {
      action: 'algorithm.text_to_image.create',
      outcome: 'success',
      resourceId: batch.batch_id,
      resourceType: 'algorithm_batch',
      statusCode: 202,
      detail: { count: batch.total, model_id: batch.model_id },
    });
    return algorithmJson(request, batch, 202, { Location: batch.links.self });
  } catch (error) {
    const status = error instanceof AlgorithmApiError ? error.status : error instanceof SyntaxError ? 400 : 500;
    await recordAuditEvent(request, {
      action: 'algorithm.text_to_image.create',
      outcome: 'error',
      resourceType: 'algorithm_batch',
      statusCode: status,
      detail: { error: error instanceof Error ? error.message : 'Algorithm API request failed' },
    });
    return algorithmError(request, error);
  }
}

export async function OPTIONS(request: Request) {
  return algorithmOptions(request);
}
