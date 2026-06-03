import { NextResponse } from 'next/server';
import { readRequestAuthContext } from '@/auth';

export async function GET(request: Request) {
  const auth = readRequestAuthContext(request);
  return NextResponse.json({
    authEnabled: auth.authEnabled,
    isAuthenticated: true,
    legacy: auth.legacy,
    role: auth.role,
  });
}
