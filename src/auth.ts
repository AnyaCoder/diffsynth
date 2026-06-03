export type ApiRole = 'viewer' | 'operator' | 'admin';
export type RequestAuthRole = ApiRole | 'open' | 'unknown';

export const REQUEST_AUTH_ROLE_HEADER = 'x-ui-auth-role';
export const REQUEST_AUTH_LEGACY_HEADER = 'x-ui-auth-legacy';
export const REQUEST_AUTH_ENABLED_HEADER = 'x-ui-auth-enabled';

const ROLE_ORDER: Record<ApiRole, number> = {
  viewer: 1,
  operator: 2,
  admin: 3,
};

interface ConfiguredToken {
  legacy: boolean;
  role: ApiRole;
  token: string;
}

interface RequestAuthContext {
  authEnabled: boolean;
  legacy: boolean;
  role: RequestAuthRole;
}

export function isApiAuthEnabled() {
  return getConfiguredTokens().length > 0;
}

export function resolveApiToken(token: string | null): { legacy: boolean; role: ApiRole } | null {
  if (!token) return null;
  const match = getConfiguredTokens().find(item => item.token === token);
  if (!match) return null;
  return { legacy: match.legacy, role: match.role };
}

export function hasRequiredRole(role: ApiRole, requiredRole: ApiRole) {
  return ROLE_ORDER[role] >= ROLE_ORDER[requiredRole];
}

export function getRequiredRole(pathname: string, method: string): ApiRole {
  const upperMethod = method.toUpperCase();

  if (pathname === '/api/auth') return 'viewer';
  if (pathname === '/api/audit') return 'admin';
  if (pathname === '/api/settings') return 'admin';
  if (pathname === '/api/datasets/delete') return 'admin';

  if (pathname === '/api/datasets/create') return 'operator';
  if (pathname === '/api/datasets/upload') return 'operator';
  if (pathname === '/api/datasets/captions/save') return 'operator';
  if (pathname === '/api/jobs' && upperMethod === 'POST') return 'operator';
  if (/^\/api\/jobs\/[^/]+\/(start|stop|archive|delete)$/.test(pathname)) return 'operator';
  if (pathname === '/api/services' && upperMethod === 'POST') return 'operator';
  if (/^\/api\/services\/[^/]+\/(start|stop|generate)$/.test(pathname)) return 'operator';
  if (/^\/api\/services\/[^/]+$/.test(pathname) && upperMethod === 'DELETE') return 'operator';

  if (upperMethod === 'GET' || upperMethod === 'HEAD') return 'viewer';
  return 'admin';
}

export function parseBearerToken(headerValue: string | null) {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.trim().split(/\s+/, 2);
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export function readRequestAuthContext(headersLike: Headers | { headers: Headers }): RequestAuthContext {
  const headers = 'headers' in headersLike ? headersLike.headers : headersLike;
  const authEnabled = headers.get(REQUEST_AUTH_ENABLED_HEADER) === '1';
  const legacy = headers.get(REQUEST_AUTH_LEGACY_HEADER) === '1';
  const rawRole = headers.get(REQUEST_AUTH_ROLE_HEADER);
  const role: RequestAuthRole =
    rawRole === 'viewer' || rawRole === 'operator' || rawRole === 'admin' || rawRole === 'open' ? rawRole : authEnabled ? 'unknown' : 'open';
  return {
    authEnabled,
    legacy,
    role,
  };
}

function getConfiguredTokens(): ConfiguredToken[] {
  const tokens: ConfiguredToken[] = [];
  const viewer = process.env.UI_VIEWER_TOKEN?.trim();
  const operator = process.env.UI_OPERATOR_TOKEN?.trim();
  const admin = process.env.UI_ADMIN_TOKEN?.trim();
  const legacy = process.env.UI_AUTH_TOKEN?.trim();

  if (viewer) tokens.push({ legacy: false, role: 'viewer', token: viewer });
  if (operator) tokens.push({ legacy: false, role: 'operator', token: operator });
  if (admin) tokens.push({ legacy: false, role: 'admin', token: admin });
  if (legacy) tokens.push({ legacy: true, role: 'admin', token: legacy });

  return tokens;
}
