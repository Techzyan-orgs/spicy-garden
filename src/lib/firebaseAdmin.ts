import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getDatabase, Database } from 'firebase-admin/database';
import fs from 'fs';
import path from 'path';

/**
 * Official Firebase Admin SDK Singleton
 * 
 * Configured using Firebase Service Account credentials.
 */

let adminApp: App | null = null;
let adminDb: Database | null = null;

function loadServiceAccount(): any | null {
  // 1. Direct environment variable (file path, raw JSON, or Base64 string)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    if (raw.endsWith('.json')) {
      const resolved = path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
      if (fs.existsSync(resolved)) {
        try {
          return JSON.parse(fs.readFileSync(resolved, 'utf-8'));
        } catch {
          // ignore
        }
      }
    }

    try {
      const jsonStr = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
      return JSON.parse(jsonStr);
    } catch {
      // ignore
    }
  }

  // 2. Individual environment variables
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  // 3. Local file: firebase-service-account.json
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

export function getFirebaseAdminApp(): App | null {
  if (adminApp) return adminApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0]!;
    return adminApp;
  }

  const serviceAccount = loadServiceAccount();
  const databaseURL = process.env.FIREBASE_DATABASE_URL;

  if (!serviceAccount || !databaseURL) {
    return null;
  }

  try {
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      databaseURL,
    });
    return adminApp;
  } catch (err) {
    console.error('[Firebase Admin] Error initializing app:', err);
    return null;
  }
}

export function getFirebaseAdminDatabase(): Database | null {
  if (adminDb) return adminDb;

  const app = getFirebaseAdminApp();
  if (!app) return null;

  try {
    adminDb = getDatabase(app);
    return adminDb;
  } catch (err) {
    console.error('[Firebase Admin] Error getting Database instance:', err);
    return null;
  }
}
