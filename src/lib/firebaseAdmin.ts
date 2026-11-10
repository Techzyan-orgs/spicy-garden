/**
 * The ONLY database access module (Firebase Realtime Database via firebase-admin).
 *
 * - Credentials come exclusively from environment variables (no key files,
 *   no legacy database secrets in query strings).
 * - Every operation either succeeds or throws. Reads never return a
 *   "default" value on failure: callers must surface DataUnavailableError
 *   (e.g. as HTTP 503) instead of serving stale or hardcoded data.
 * - Every operation has a timeout so a lost connection cannot hang a
 *   serverless function until Vercel kills it.
 *
 * Node runtime only.
 */
import { getApps, initializeApp, cert, App, ServiceAccount } from 'firebase-admin/app';
import { getDatabase, Database } from 'firebase-admin/database';
import { ConfigError } from './env';

export class DataUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'DataUnavailableError';
    if (options?.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

const APP_NAME = 'spicy-garden-admin';
// Well under Vercel's 10s Hobby function limit, so callers can still return a clean 503.
const DEFAULT_TIMEOUT_MS = 5000;

/** Firebase keys may not contain . # $ [ ] / — we additionally restrict to a safe charset. */
const SAFE_KEY = /^[A-Za-z0-9_-]{1,128}$/;

export function isSafeKey(key: unknown): key is string {
  return typeof key === 'string' && SAFE_KEY.test(key);
}

export function assertSafeKey(key: unknown, label = 'key'): string {
  if (!isSafeKey(key)) {
    throw new InvalidKeyError(`Invalid ${label}: only letters, digits, "_" and "-" are allowed (max 128).`);
  }
  return key;
}

export class InvalidKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidKeyError';
  }
}

function parseServiceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (raw) {
    let json: string = raw;
    if ((json.startsWith("'") && json.endsWith("'")) || (json.startsWith('"') && json.endsWith('"'))) {
      json = json.slice(1, -1).trim();
    }
    if (!json.startsWith('{')) {
      json = Buffer.from(json, 'base64').toString('utf8');
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new ConfigError('FIREBASE_SERVICE_ACCOUNT_KEY must be the service account JSON (raw or base64-encoded).');
    }
    const projectId = (parsed.project_id ?? parsed.projectId) as string | undefined;
    const clientEmail = (parsed.client_email ?? parsed.clientEmail) as string | undefined;
    const privateKey = (parsed.private_key ?? parsed.privateKey) as string | undefined;
    if (!projectId || !clientEmail || !privateKey) {
      throw new ConfigError('FIREBASE_SERVICE_ACCOUNT_KEY is missing project_id, client_email or private_key.');
    }
    return { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, '\n') };
  }

  throw new ConfigError(
    'Firebase credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY, or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.'
  );
}

function getDatabaseUrl(): string {
  const url = process.env.FIREBASE_DATABASE_URL?.trim().replace(/\/+$/, '');
  if (!url) throw new ConfigError('Missing required environment variable: FIREBASE_DATABASE_URL');
  if (!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.(firebasedatabase\.app|firebaseio\.com)$/i.test(url)) {
    throw new ConfigError('FIREBASE_DATABASE_URL must be an https://*.firebasedatabase.app or *.firebaseio.com URL.');
  }
  return url;
}

let cachedDb: Database | null = null;

function getAdminApp(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;
  return initializeApp(
    { credential: cert(parseServiceAccount()), databaseURL: getDatabaseUrl() },
    APP_NAME
  );
}

/** Returns the database handle. Throws ConfigError when misconfigured. */
export function getDb(): Database {
  if (!cachedDb) cachedDb = getDatabase(getAdminApp());
  return cachedDb;
}

/** True when all Firebase environment variables are present and parseable. */
export function isFirebaseConfigured(): boolean {
  try {
    parseServiceAccount();
    getDatabaseUrl();
    return true;
  } catch {
    return false;
  }
}

async function withTimeout<T>(op: string, path: string, fn: () => Promise<T>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new DataUnavailableError(`Firebase ${op} ${path} timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      }),
    ]);
  } catch (err) {
    if (err instanceof ConfigError || err instanceof DataUnavailableError) throw err;
    throw new DataUnavailableError(`Firebase ${op} ${path} failed`, { cause: err });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizePath(path: string): string {
  const clean = path.replace(/^\/+|\/+$/g, '');
  if (clean.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) {
    throw new InvalidKeyError(`Invalid database path: ${path}`);
  }
  return clean;
}

/** Reads a node. Returns null only when the node does not exist; throws on any failure. */
export async function dbGet<T>(path: string): Promise<T | null> {
  const p = normalizePath(path);
  return withTimeout('GET', p, async () => {
    const snap = await getDb().ref(p).once('value');
    return snap.exists() ? (snap.val() as T) : null;
  });
}

/** Replaces a node. Throws on failure. */
export async function dbSet<T>(path: string, value: T): Promise<void> {
  const p = normalizePath(path);
  await withTimeout('SET', p, () => getDb().ref(p).set(value));
}

/** Multi-path / partial update relative to `path`. Atomic. Throws on failure. */
export async function dbUpdate(path: string, values: Record<string, unknown>): Promise<void> {
  const p = normalizePath(path);
  await withTimeout('UPDATE', p, () => getDb().ref(p).update(values));
}

/**
 * Atomic read-modify-write. `update` receives the current value (null if absent)
 * and returns the new value, or undefined to abort without writing.
 * Resolves with the committed value (or the current value when aborted).
 */
export async function dbTransaction<T>(
  path: string,
  update: (current: T | null) => T | null | undefined
): Promise<{ committed: boolean; value: T | null }> {
  const p = normalizePath(path);
  return withTimeout('TRANSACTION', p, async () => {
    const result = await getDb()
      .ref(p)
      .transaction((current: T | null) => update(current ?? null), undefined, false);
    return { committed: result.committed, value: (result.snapshot.val() as T | null) ?? null };
  });
}

/** Deletes a node. Throws on failure. */
export async function dbRemove(path: string): Promise<void> {
  const p = normalizePath(path);
  await withTimeout('REMOVE', p, () => getDb().ref(p).remove());
}
