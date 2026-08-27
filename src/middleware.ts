import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  getRequiredRole,
  hasRequiredRole,
  isApiAuthEnabled,
  parseBearerToken,
  REQUEST_AUTH_ENABLED_HEADER,
  REQUEST_AUTH_LEGACY_HEADER,
  REQUEST_AUTH_ROLE_HEADER,
  resolveApiToken,
} from './auth';
import { getAlgorithmCorsHeaders, isAlgorithmApiPath, isAlgorithmOriginAllowed } from './domain/algorithmApiCors';

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const algorithmRequest = isAlgorithmApiPath(request.nextUrl.pathname);
  const origin = request.headers.get('origin');

  if (algorithmRequest && !isAlgorithmOriginAllowed(origin)) {
    return NextResponse.json(
      { error: { code: 'CORS_ORIGIN_DENIED', message: 'Origin is not allowed to call the algorithm API' } },
      { status: 403, headers: { Vary: 'Origin' } },
    );
  }

  if (algorithmRequest && request.method.toUpperCase() === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: getAlgorithmCorsHeaders(origin) });
  }

  if (!isApiAuthEnabled()) {
    requestHeaders.set(REQUEST_AUTH_ENABLED_HEADER, '0');
    requestHeaders.set(REQUEST_AUTH_ROLE_HEADER, 'open');
    requestHeaders.delete(REQUEST_AUTH_LEGACY_HEADER);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const token = parseBearerToken(request.headers.get('Authorization'));
  const auth = resolveApiToken(token);
  if (!auth) {
    return unauthorized('Unauthorized', algorithmRequest ? getAlgorithmCorsHeaders(origin) : undefined, algorithmRequest);
  }

  const requiredRole = getRequiredRole(request.nextUrl.pathname, request.method);
  if (!hasRequiredRole(auth.role, requiredRole)) {
    return forbidden(
      `Forbidden: requires ${requiredRole} role`,
      algorithmRequest ? getAlgorithmCorsHeaders(origin) : undefined,
      algorithmRequest,
    );
  }

  requestHeaders.set(REQUEST_AUTH_ENABLED_HEADER, '1');
  requestHeaders.set(REQUEST_AUTH_ROLE_HEADER, auth.role);
  requestHeaders.set(REQUEST_AUTH_LEGACY_HEADER, auth.legacy ? '1' : '0');
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/api/:path*'],
};

function unauthorized(message: string, headers?: HeadersInit, structured = false) {
  return NextResponse.json(
    structured ? { error: { code: 'UNAUTHORIZED', message } } : { error: message },
    { status: 401, headers },
  );
}

function forbidden(message: string, headers?: HeadersInit, structured = false) {
  return NextResponse.json(
    structured ? { error: { code: 'FORBIDDEN', message } } : { error: message },
    { status: 403, headers },
  );
}
