/**
 * Cross-instance idempotency for order submission, stored in Firebase at
 * security/idempotency/{sha256(key)} with a short TTL.
 *
 *   claim()    → "claimed" (go ahead), "in_progress" (duplicate in flight) or "done" (replay)
 *   complete() → stores a PII-free replay payload
 *   release()  → frees the key after a failed attempt so the client can retry
 *
 * Node runtime only.
 */
import { createHash } from 'crypto';
import { dbRemove, dbSet, dbTransaction, getDb } from './firebaseAdmin';

const ROOT = 'security/idempotency';
const TTL_MS = 2 * 60_000;
/** A crashed attempt stops blocking retries after this long. */
const PENDING_TTL_MS = 30_000;

interface IdemRecord {
  state: 'pending' | 'done';
  expiresAt: number;
  response?: Record<string, unknown>;
}

export type ClaimResult =
  | { status: 'claimed' }
  | { status: 'in_progress' }
  | { status: 'done'; response: Record<string, unknown> };

function pathFor(key: string): string {
  return `${ROOT}/${createHash('sha256').update(key).digest('hex').slice(0, 40)}`;
}

export async function claimIdempotencyKey(key: string): Promise<ClaimResult> {
  const now = Date.now();
  let outcome: ClaimResult = { status: 'claimed' };
  await dbTransaction<IdemRecord>(pathFor(key), (cur) => {
    if (!cur || typeof cur.expiresAt !== 'number' || cur.expiresAt <= now) {
      outcome = { status: 'claimed' };
      return { state: 'pending', expiresAt: now + PENDING_TTL_MS };
    }
    outcome = cur.state === 'done' && cur.response ? { status: 'done', response: cur.response } : { status: 'in_progress' };
    return undefined; // abort: leave the existing record untouched
  });
  maybeSweep(now);
  return outcome;
}

export async function completeIdempotencyKey(key: string, response: Record<string, unknown>): Promise<void> {
  await dbSet<IdemRecord>(pathFor(key), { state: 'done', expiresAt: Date.now() + TTL_MS, response });
}

export async function releaseIdempotencyKey(key: string): Promise<void> {
  await dbRemove(pathFor(key)).catch(() => {});
}

function maybeSweep(now: number) {
  if (Math.random() > 0.05) return;
  const ref = getDb().ref(ROOT);
  ref
    .orderByChild('expiresAt')
    .endAt(now)
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
