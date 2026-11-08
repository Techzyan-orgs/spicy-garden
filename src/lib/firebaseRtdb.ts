import fs from 'fs';
import path from 'path';
import { JWT } from 'google-auth-library';

/**
 * Firebase Realtime Database Service
 * 
 * Supports modern Google Cloud Service Account IAM authentication
 * (eliminates deprecated Firebase Database Secrets).
 * 
 * Authentication options supported:
 * 1. FIREBASE_SERVICE_ACCOUNT_KEY (file path, raw JSON string, or Base64 JSON)
 * 2. Individual env vars: FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_PROJECT_ID
 * 3. Local file: ./firebase-service-account.json
 * 4. Legacy fallback: FIREBASE_DATABASE_SECRET (via ?auth=)
 */

export interface FirebaseServiceAccount {
  project_id?: string;
  projectId?: string;
  client_email?: string;
  clientEmail?: string;
  private_key?: string;
  privateKey?: string;
}

let jwtClient: JWT | null = null;
let lastServiceAccountSignature = '';

function hasServiceAccountConfig(): boolean {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) return true;
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) return true;

  try {
    const localFile = path.join(process.cwd(), 'firebase-service-account.json');
    return fs.existsSync(localFile);
  } catch {
    return false;
  }
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_DATABASE_URL &&
    (
      hasServiceAccountConfig() ||
      process.env.FIREBASE_DATABASE_SECRET ||
      process.env.FIREBASE_AUTH_TOKEN
    )
  );
}

function loadServiceAccount(): FirebaseServiceAccount | null {
  // 1. Direct environment variable (file path, raw JSON, or Base64 string)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();

    // Check if it's a file path
    if (raw.endsWith('.json')) {
      const resolved = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
      if (fs.existsSync(resolved)) {
        try {
          return JSON.parse(fs.readFileSync(resolved, 'utf-8'));
        } catch (e) {
          console.error('[Firebase RTDB] Error reading service account from file path:', e);
        }
      }
    }

    // Check if it's JSON or Base64 JSON
    try {
      let cleaned = raw;
      if (
        (cleaned.startsWith("'") && cleaned.endsWith("'")) ||
        (cleaned.startsWith('"') && cleaned.endsWith('"'))
      ) {
        cleaned = cleaned.slice(1, -1).trim();
      }
      const jsonStr = cleaned.startsWith('{')
        ? cleaned
        : Buffer.from(cleaned, 'base64').toString('utf-8');
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('[Firebase RTDB] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e);
    }
  }

  // 2. Individual environment variables
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  // 3. Local file: firebase-service-account.json (auto-detected in project root)
  try {
    const localFile = path.join(process.cwd(), 'firebase-service-account.json');
    if (fs.existsSync(localFile)) {
      return JSON.parse(fs.readFileSync(localFile, 'utf-8'));
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Mint or retrieve cached Google OAuth 2.0 Access Token using Service Account credentials.
 */
async function getAccessToken(): Promise<string | null> {
  const sa = loadServiceAccount();
  if (!sa) return null;

  const email = sa.client_email || sa.clientEmail;
  const rawKey = sa.private_key || sa.privateKey;
  if (!email || !rawKey) return null;

  const key = rawKey.replace(/\\n/g, '\n');
  const signature = `${email}:${key.slice(0, 30)}`;

  if (!jwtClient || lastServiceAccountSignature !== signature) {
    jwtClient = new JWT({
      email,
      key,
      scopes: [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/firebase.database',
      ],
    });
    lastServiceAccountSignature = signature;
  }

  try {
    const tokenResponse = await jwtClient.getAccessToken();
    return tokenResponse?.token || null;
  } catch (err) {
    console.error('[Firebase RTDB] Error generating Service Account OAuth2 token:', err);
    return null;
  }
}

function getDatabaseBaseUrl(): string {
  const url = process.env.FIREBASE_DATABASE_URL || '';
  return url.replace(/\/+$/, '');
}

async function prepareFirebaseRequest(path: string): Promise<{ url: string; headers: Record<string, string> } | null> {
  const baseUrl = getDatabaseBaseUrl();
  if (!baseUrl) return null;

  const cleanPath = path.replace(/^\/+/, '').replace(/\/+$/, '');
  const token = await getAccessToken();

  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  let url = `${baseUrl}/${cleanPath}.json`;

  if (token) {
    // Modern Google Cloud IAM OAuth 2.0 Bearer token
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    // Legacy fallback: database secret query param
    const secret = process.env.FIREBASE_DATABASE_SECRET || process.env.FIREBASE_AUTH_TOKEN;
    if (secret) {
      url += `?auth=${encodeURIComponent(secret)}`;
    }
  }

  return { url, headers };
}

/**
 * Fetch data from Firebase Realtime Database at a specified path.
 */
export async function getFirebaseData<T>(path: string): Promise<T | null> {
  if (!isFirebaseConfigured()) return null;

  try {
    const req = await prepareFirebaseRequest(path);
    if (!req) return null;

    const res = await fetch(req.url, {
      method: 'GET',
      headers: req.headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      console.warn(`[Firebase RTDB] GET ${path} returned HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    return data as T;
  } catch (err) {
    console.error(`[Firebase RTDB] Error fetching ${path}:`, err);
    return null;
  }
}

/**
 * Replace/set data in Firebase Realtime Database at a specified path (PUT).
 */
export async function setFirebaseData<T>(path: string, data: T): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;

  try {
    const req = await prepareFirebaseRequest(path);
    if (!req) return false;

    const res = await fetch(req.url, {
      method: 'PUT',
      headers: {
        ...req.headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Firebase RTDB] PUT ${path} failed (${res.status}):`, errText);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[Firebase RTDB] Error writing to ${path}:`, err);
    return false;
  }
}

/**
 * Merge/update specific fields in Firebase Realtime Database at a specified path (PATCH).
 */
export async function updateFirebaseData<T extends object>(path: string, data: T): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;

  try {
    const req = await prepareFirebaseRequest(path);
    if (!req) return false;

    const res = await fetch(req.url, {
      method: 'PATCH',
      headers: {
        ...req.headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    return res.ok;
  } catch (err) {
    console.error(`[Firebase RTDB] Error updating ${path}:`, err);
    return false;
  }
}

/**
 * Delete a node in Firebase Realtime Database at a specified path (DELETE).
 */
export async function deleteFirebaseData(path: string): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;

  try {
    const req = await prepareFirebaseRequest(path);
    if (!req) return false;

    const res = await fetch(req.url, {
      method: 'DELETE',
      headers: req.headers,
    });

    return res.ok;
  } catch (err) {
    console.error(`[Firebase RTDB] Error deleting ${path}:`, err);
    return false;
  }
}
