import { NextResponse } from 'next/server';
import { getAlgorithmCorsHeaders } from '@/domain/algorithmApiCors';
import { AlgorithmApiError } from '@/server/algorithmApi';

export function algorithmJson(request: Request, payload: unknown, status = 200, extraHeaders?: HeadersInit) {
  const headers = new Headers(getAlgorithmCorsHeaders(request.headers.get('origin')));
  new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  return NextResponse.json(payload, { status, headers });
}

export function algorithmOptions(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: getAlgorithmCorsHeaders(request.headers.get('origin')),
  });
}

export function algorithmError(request: Request, error: unknown) {
  if (error instanceof AlgorithmApiError) {
    return algorithmJson(request, { error: error.toPayload() }, error.status);
  }
  if (error instanceof SyntaxError) {
    return algorithmJson(
      request,
      { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      400,
    );
  }

  const maybePrismaError = error as { code?: string; message?: string };
  if (maybePrismaError?.code === 'P2002') {
    return algorithmJson(
      request,
      { error: { code: 'RESOURCE_CONFLICT', message: 'A conflicting algorithm job already exists' } },
      409,
    );
  }

  console.error('algorithm API request failed', error);
  return algorithmJson(
    request,
    { error: { code: 'INTERNAL_ERROR', message: 'Algorithm API request failed' } },
    500,
  );
}
