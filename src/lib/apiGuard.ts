/**
 * Shared helpers for API route handlers (Node runtime):
 *  - requireAdmin(): full owner check (JWT + server-side session version)
 *  - jsonError(): consistent error responses that never leak internals
 *  - parseBody(): JSON body parsing + zod validation
 *  - getClientIp(): client IP from headers the hosting platform controls
 *  - enforceRateLimit(): distributed rate limiting → 429 response
 */
import { NextRequest, NextResponse } from 'next/server';
import { z, ZodTypeAny } from 'zod';
import { isAdminRequest } from './authServer';
import { consumeRateLimit, RateLimitBucket } from './rateLimit';

const NO_STORE = { 'Cache-Control': 'no-store' };

export function jsonError(
  status: number,
  message: string,
  extra?: Record<string, unknown>,
  headers?: Record<string, string>
): NextResponse {
  return NextResponse.json({ error: message, ...extra }, { status, headers: { ...NO_STORE, ...headers } });
}

/** Returns a 401 response when the request is not from a valid, unrevoked owner session; otherwise null. */
export async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  if (await isAdminRequest(req)) return null;
  return jsonError(401, 'Unauthorized: Owner session required.');
}

/**
 * Client IP for rate limiting. On Vercel, `x-real-ip` and `x-forwarded-for`
 * are set by the platform edge (client-supplied values are overwritten), so
 * they cannot be spoofed. Headers like `cf-connecting-ip` are NOT trusted.
 */
export function getClientIp(req: NextRequest): string {
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real;
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (fwd) return fwd;
  return '127.0.0.1';
}

type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/** Parses and validates a JSON body. Responds 400 with field issues on failure. */
export async function parseBody<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<ParseResult<z.infer<S>>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: jsonError(400, 'Request body must be valid JSON.') };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.slice(0, 10).map((i) => ({
      field: i.path.join('.') || '(body)',
      message: i.message,
    }));
    return {
      ok: false,
      response: jsonError(400, issues[0] ? `${issues[0].field}: ${issues[0].message}` : 'Invalid request.', { issues }),
    };
  }
  return { ok: true, data: result.data };
}

/** Counts one event for this client in `bucket`; returns a 429 response when over the limit, else null. */
export async function enforceRateLimit(
  bucket: RateLimitBucket,
  key: string,
  message = 'Too many requests. Please wait a few minutes and try again.'
): Promise<NextResponse | null> {
  const r = await consumeRateLimit(bucket, key);
  if (r.allowed) return null;
  return jsonError(429, message, { retryAfterSeconds: r.retryAfterSeconds }, { 'Retry-After': String(r.retryAfterSeconds) });
}
