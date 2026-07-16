import { requireFirebaseUid } from './auth';
import {
  actionError,
  corsHeaders,
  isAllowedBrowserRequest,
  jsonResponse,
  parseJsonRecord,
  readBody,
  simpleError,
} from './http';
import {
  claimActionRateLimits,
  claimCloudinaryIngress,
  claimSyncIngress,
  claimSyncUser,
  RateLimitError,
} from './rate-limit';
import { verifyCloudinarySignature } from './signature';
import type { Env } from './types';

function clientIp(request: Request) {
  return request.headers.get('cf-connecting-ip')?.trim() || 'unknown';
}

function originUrl(env: Env, role: string) {
  const base = env.SUPABASE_FUNCTIONS_BASE_URL.replace(/\/+$/u, '');
  return `${base}/n${env.EDGE_FUNCTION_NAMESPACE}-${role}`;
}

function upstreamHeaders(request: Request, env: Env) {
  const headers = new Headers();
  for (const name of ['authorization', 'content-type', 'x-cld-signature', 'x-cld-timestamp']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-novae-origin-secret', env.EDGE_ORIGIN_SECRET);
  headers.set('x-request-id', crypto.randomUUID());
  return headers;
}

async function forward(request: Request, env: Env, role: string, body: Uint8Array) {
  const upstreamBody = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
  const upstream = await fetch(originUrl(env, role), {
    method: 'POST',
    headers: upstreamHeaders(request, env),
    body: upstreamBody,
    signal: AbortSignal.timeout(30_000),
  });
  const headers = new Headers(upstream.headers);
  for (const name of [
    'access-control-allow-headers',
    'access-control-allow-methods',
    'access-control-allow-origin',
    'access-control-max-age',
  ]) {
    headers.delete(name);
  }
  for (const [name, value] of Object.entries(corsHeaders(request, env))) headers.set(name, value);
  headers.set('cache-control', 'no-store');
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}

async function handleAction(request: Request, env: Env, requestId: string) {
  if (!isAllowedBrowserRequest(request, env)) return actionError(request, env, requestId, 403, 'origin-denied', '不允許的請求來源。');
  const body = await readBody(request);
  const parsed = parseJsonRecord(body);
  const action = typeof parsed.action === 'string' ? parsed.action : '';
  if (!action) return actionError(request, env, requestId, 400, 'invalid-action', '請求格式不正確。');
  const uid = await requireFirebaseUid(request, env);
  await claimActionRateLimits(env, uid, action, parsed);
  return await forward(request, env, 'api', body);
}

async function handleSync(request: Request, env: Env) {
  if (!isAllowedBrowserRequest(request, env)) return simpleError(request, env, 403, '不允許的請求來源。');
  const body = await readBody(request);
  parseJsonRecord(body);
  await claimSyncIngress(env, clientIp(request));
  const uid = await requireFirebaseUid(request, env);
  await claimSyncUser(env, uid);
  return await forward(request, env, 'sync', body);
}

async function handleCloudinary(request: Request, env: Env) {
  const body = await readBody(request);
  if (!await verifyCloudinarySignature(request, body, env.CLOUDINARY_WEBHOOK_SECRET)) {
    return simpleError(request, env, 401, 'Invalid Cloudinary signature.');
  }
  await claimCloudinaryIngress(env, clientIp(request));
  return await forward(request, env, 'media', body);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID();
    if (request.method === 'OPTIONS') {
      if (!isAllowedBrowserRequest(request, env)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    if (request.method !== 'POST') return jsonResponse(request, env, { error: 'method-not-allowed' }, 405, { allow: 'POST, OPTIONS' });

    try {
      const pathname = new URL(request.url).pathname;
      if (pathname === '/v1/actions') return await handleAction(request, env, requestId);
      if (pathname === '/v1/auth/sync') return await handleSync(request, env);
      if (pathname === '/v1/webhooks/cloudinary') return await handleCloudinary(request, env);
      return jsonResponse(request, env, { error: 'not-found' }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'internal-error';
      console.error({ message, requestId, path: new URL(request.url).pathname });
      if (error instanceof RateLimitError) {
        const headers = { 'retry-after': String(error.retryAfter) };
        return new URL(request.url).pathname === '/v1/actions'
          ? actionError(request, env, requestId, 429, 'rate-limited', error.message, headers)
          : simpleError(request, env, 429, error.message, headers);
      }
      if (message === 'rate-limit-provider-unavailable') {
        return new URL(request.url).pathname === '/v1/actions'
          ? actionError(request, env, requestId, 503, message, '限流服務暫時無法使用，請稍後再試。')
          : simpleError(request, env, 503, '限流服務暫時無法使用，請稍後再試。');
      }
      if (message === 'unauthenticated') {
        return new URL(request.url).pathname === '/v1/actions'
          ? actionError(request, env, requestId, 401, message, '請先登入後再操作。')
          : simpleError(request, env, 401, '請先登入後再操作。');
      }
      const status = message === 'request-too-large' ? 413 : message === 'invalid-json' || message === 'unsupported-action' ? 400 : 502;
      return new URL(request.url).pathname === '/v1/actions'
        ? actionError(request, env, requestId, status, message, status === 502 ? '服務暫時無法處理請求，請稍後再試。' : '請求格式不正確。')
        : simpleError(request, env, status, status === 502 ? '服務暫時無法處理請求，請稍後再試。' : '請求格式不正確。');
    }
  },
};
