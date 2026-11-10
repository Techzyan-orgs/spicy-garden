/**
 * Fixed-window rate limiting shared by every serverless instance, stored in
 * Firebase RTDB at security/rate_limits/{bucket}/{hashedKey} and updated with
 * transactions so concurrent requests cannot slip past the limit.
 *
 * Keys (usually client IPs) are HMAC-hashed so raw IPs are never stored.
 * Database failures throw DataUnavailableError (callers return 503): limits
 * fail closed rather than silently disappearing.
 *
 * Node runtime only.
 */
import { createHmac } from 'crypto';
import { dbGet, dbRemove, dbTransaction, getDb } from './firebaseAdmin';
import { getSessionSecret } from './env';

export interface RateLimitRule {
  /** Max events allowed per window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface WindowRecord {
  count: number;
  resetAt: number;
}

export const RATE_LIMITS = {
  /** Failed owner logins per IP. */
  loginIp: { limit: 5, windowMs: 15 * 60_000 },
  /** Failed owner logins across all IPs (single owner account → account lockout). */
  loginAccount: { limit: 20, windowMs: 15 * 60_000 },
  /** Public orders / reservations per IP. */
  orders: { limit: 10, windowMs: 10 * 60_000 },
  /** WhatsApp consent submissions per IP. */
  consent: { limit: 5, windowMs: 15 * 60_000 },
  /** Reverse geocoding per IP. */
  geocode: { limit: 15, windowMs: 60_000 },
  /** Unsubscribe requests per IP. */
  unsubscribe: { limit: 5, windowMs: 15 * 60_000 },
  /** WhatsApp confirmations per recipient phone (stops message-cost abuse). */
  waConfirm: { limit: 1, windowMs: 10 * 60_000 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

const ROOT = 'security/rate_limits';

function hashKey(key: string): string {
  return createHmac('sha256', getSessionSecret()).update(`rate-limit:${key}`).digest('hex').slice(0, 32);
}

function pathFor(bucket: RateLimitBucket, key: string): string {
  return `${ROOT}/${bucket}/${hashKey(key)}`;
}

function toResult(rec: WindowRecord | null, rule: RateLimitRule, now: number): RateLimitResult {
  if (!rec || rec.resetAt <= now) return { allowed: true, remaining: rule.limit, retryAfterSeconds: 0 };
  const allowed = rec.count <= rule.limit;
  return {
    allowed,
    remaining: Math.max(0, rule.limit - rec.count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((rec.resetAt - now) / 1000)),
  };
}

/** Counts one event and reports whether it is within the limit. */
export async function consumeRateLimit(bucket: RateLimitBucket, key: string): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[bucket];
  const now = Date.now();
  const { value } = await dbTransaction<WindowRecord>(pathFor(bucket, key), (cur) => {
    if (!cur || typeof cur.resetAt !== 'number' || cur.resetAt <= now) {
      return { count: 1, resetAt: now + rule.windowMs };
    }
    return { count: (cur.count || 0) + 1, resetAt: cur.resetAt };
  });
  maybeSweep(bucket, now);
  return toResult(value, rule, now);
}

/** Reports whether further events are allowed, without counting one. */
export async function peekRateLimit(bucket: RateLimitBucket, key: string): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[bucket];
  const now = Date.now();
  const rec = await dbGet<WindowRecord>(pathFor(bucket, key));
  // "Allowed" for a peek means one more event would still be within the limit.
  if (!rec || rec.resetAt <= now) return { allowed: true, remaining: rule.limit, retryAfterSeconds: 0 };
  const allowed = rec.count < rule.limit;
  return {
    allowed,
    remaining: Math.max(0, rule.limit - rec.count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((rec.resetAt - now) / 1000)),
  };
}

export async function resetRateLimit(bucket: RateLimitBucket, key: string): Promise<void> {
  await dbRemove(pathFor(bucket, key));
}

/**
 * Occasionally deletes expired windows so the bucket does not grow forever.
 * Best effort, fire-and-forget.
 */
function maybeSweep(bucket: RateLimitBucket, now: number) {
  if (Math.random() > 0.02) return;
  const ref = getDb().ref(`${ROOT}/${bucket}`);
  ref
    .orderByChild('resetAt')
    .endAt(now - 60_000)
    .limitToFirst(200)
    .once('value')
    .then((snap) => {
      const updates: Record<string, null> = {};
      snap.forEach((child) => {
        updates[child.key as string] = null;
      });
      if (Object.keys(updates).length) return ref.update(updates);
    })
    .catch(() => {});
}
