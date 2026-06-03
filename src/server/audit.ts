import prisma from './prisma';
import { readRequestAuthContext } from '../auth';

interface AuditEventInput {
  action: string;
  detail?: unknown;
  outcome: 'success' | 'error';
  resourceId?: string | null;
  resourceType?: string | null;
  statusCode: number;
}

export async function recordAuditEvent(request: Request, input: AuditEventInput) {
  try {
    const auth = readRequestAuthContext(request);
    await prisma.auditLog.create({
      data: {
        action: input.action,
        actor_role: auth.role,
        auth_legacy: auth.legacy,
        detail_json: input.detail == null ? null : safeStringify(input.detail),
        ip_address: getClientIp(request),
        outcome: input.outcome,
        request_method: request.method,
        request_path: new URL(request.url).pathname,
        resource_id: input.resourceId ?? null,
        resource_type: input.resourceType ?? null,
        status_code: input.statusCode,
        user_agent: request.headers.get('user-agent'),
      },
    });
  } catch (error) {
    console.error('failed to record audit event', error);
  }
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip');
}

function safeStringify(value: unknown) {
  const text = JSON.stringify(value);
  return text.length > 8000 ? `${text.slice(0, 8000)}...` : text;
}
