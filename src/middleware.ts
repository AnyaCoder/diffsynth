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

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  if (!isApiAuthEnabled()) {
    requestHeaders.set(REQUEST_AUTH_ENABLED_HEADER, '0');
    requestHeaders.set(REQUEST_AUTH_ROLE_HEADER, 'open');
    requestHeaders.delete(REQUEST_AUTH_LEGACY_HEADER);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const token = parseBearerToken(request.headers.get('Authorization'));
  const auth = resolveApiToken(token);
  if (!auth) {
    return unauthorized('Unauthorized');
  }

  const requiredRole = getRequiredRole(request.nextUrl.pathname, request.method);
  if (!hasRequiredRole(auth.role, requiredRole)) {
    return forbidden(`Forbidden: requires ${requiredRole} role`);
  }

  requestHeaders.set(REQUEST_AUTH_ENABLED_HEADER, '1');
  requestHeaders.set(REQUEST_AUTH_ROLE_HEADER, auth.role);
  requestHeaders.set(REQUEST_AUTH_LEGACY_HEADER, auth.legacy ? '1' : '0');
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/api/:path*'],
};

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}
