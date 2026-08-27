const DEFAULT_ALLOWED_ORIGINS = ['null', 'http://localhost:*', 'http://127.0.0.1:*'];

export function isAlgorithmApiPath(pathname: string) {
  return pathname === '/api/algorithm/v1' || pathname.startsWith('/api/algorithm/v1/');
}

export function isAlgorithmOriginAllowed(origin: string | null) {
  if (!origin) return true;
  return getAllowedOrigins().some(pattern => originMatches(origin, pattern));
}

export function getAlgorithmCorsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Expose-Headers': 'Location',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  if (origin && isAlgorithmOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = getAllowedOrigins().includes('*') ? '*' : origin;
  }
  return headers;
}

function getAllowedOrigins() {
  const configured = process.env.ALGORITHM_API_ALLOWED_ORIGINS?.trim();
  if (!configured) return DEFAULT_ALLOWED_ORIGINS;
  return configured
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function originMatches(origin: string, pattern: string) {
  if (pattern === '*') return true;
  if (!pattern.endsWith('*')) return origin === pattern;
  return origin.startsWith(pattern.slice(0, -1));
}
