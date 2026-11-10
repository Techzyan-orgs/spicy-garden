/**
 * Shared Firebase Admin bootstrap for maintenance scripts.
 * Loads .env / .env.local the same way Next.js does, then connects with the
 * service account from environment variables only.
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

require('@next/env').loadEnvConfig(root);
const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

function serviceAccount() {
  let raw = (process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '').trim();
  if (raw) {
    if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) raw = raw.slice(1, -1).trim();
    const json = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    return {
      projectId: json.project_id ?? json.projectId,
      clientEmail: json.client_email ?? json.clientEmail,
      privateKey: String(json.private_key ?? json.privateKey).replace(/\\n/g, '\n'),
    };
  }
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }
  throw new Error('Firebase credentials are not configured (see .env.example).');
}

export function connect() {
  const databaseURL = (process.env.FIREBASE_DATABASE_URL || '').trim();
  if (!databaseURL) throw new Error('FIREBASE_DATABASE_URL is not set.');
  const app = initializeApp({ credential: cert(serviceAccount()), databaseURL });
  console.log(`Connected to ${databaseURL}`);
  return getDatabase(app);
}

/** Writes a local JSON backup under ./.backups and returns its path. */
export function backup(name, data) {
  const dir = path.join(root, '.backups');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

export const APPLY = process.argv.includes('--apply');
