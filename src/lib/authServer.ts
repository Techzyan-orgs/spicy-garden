/**
 * Node-only owner authentication helpers (password verification and
 * server-side session revocation). Not importable from Edge middleware.
 */
import { scryptSync, timingSafeEqual, createHash } from 'crypto';
import type { NextRequest } from 'next/server';
import { getOwnerEmail, getOwnerPasswordHash } from './env';
import { decodeOwnerSessionToken, OWNER_SESSION_COOKIE } from './auth';
import { getFirebaseDataStrict, setFirebaseData } from './firebaseRtdb';

const SESSION_VERSION_PATH = 'security/session_version';
const SCRYPT_MAX_MEM = 128 * 1024 * 1024;

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function verifyScryptHash(password: string, encoded: string): boolean {
  const [, nStr, rStr, pStr, saltB64, hashB64] = encoded.split(':');
  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(password, salt, expected.length, { N, r, p, maxmem: SCRYPT_MAX_MEM });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Constant-time verification of owner credentials. Both the email and the
 * password are always checked so response timing does not reveal which failed.
 */
export function verifyOwnerCredentials(email: string, password: string): boolean {
  const ownerEmail = getOwnerEmail();
  const passwordHash = getOwnerPasswordHash();
  if (typeof email !== 'string' || typeof password !== 'string') return false;
  if (password.length === 0 || password.length > 256) return false;

  const emailOk = timingSafeEqual(sha256(email.trim().toLowerCase()), sha256(ownerEmail));
  const passwordOk = verifyScryptHash(password, passwordHash);
  return emailOk && passwordOk;
}

/** Current server-side session version. Throws if the database is unavailable (fail closed). */
export async function getSessionVersion(): Promise<number> {
  const value = await getFirebaseDataStrict<number>(SESSION_VERSION_PATH);
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 1;
}

/** Invalidates every existing owner session (all devices). */
export async function revokeAllOwnerSessions(): Promise<void> {
  const current = await getSessionVersion();
  const ok = await setFirebaseData(SESSION_VERSION_PATH, current + 1);
  if (!ok) throw new Error('Failed to revoke sessions: database write failed.');
}

/**
 * Full owner authorisation for route handlers: valid JWT AND matching
 * session version. Any error (misconfiguration, DB outage) yields false.
 */
export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  try {
    const claims = await decodeOwnerSessionToken(req.cookies.get(OWNER_SESSION_COOKIE)?.value);
    if (!claims) return false;
    return claims.sv === (await getSessionVersion());
  } catch (err) {
    console.error('[Auth] Admin authorisation check failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
