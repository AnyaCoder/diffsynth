import { stopTextToImageBatch, AlgorithmApiError } from '@/server/algorithmApi';
import { algorithmError, algorithmJson, algorithmOptions } from '../../../http';
import { recordAuditEvent } from '@/server/audit';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const batch = await stopTextToImageBatch(id);
    await recordAuditEvent(request, {
      action: 'algorithm.batch.stop',
      outcome: 'success',
      resourceId: id,
      resourceType: 'algorithm_batch',
      statusCode: 200,
      detail: { status: batch.status },
    });
    return algorithmJson(request, batch);
  } catch (error) {
    const status = error instanceof AlgorithmApiError ? error.status : 500;
    await recordAuditEvent(request, {
      action: 'algorithm.batch.stop',
      outcome: 'error',
      resourceId: id,
      resourceType: 'algorithm_batch',
      statusCode: status,
      detail: { error: error instanceof Error ? error.message : 'Failed to stop algorithm batch' },
    });
    return algorithmError(request, error);
  }
}

export async function OPTIONS(request: Request) {
  return algorithmOptions(request);
}
