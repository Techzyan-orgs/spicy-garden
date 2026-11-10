import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { encryptSensitiveData, decryptSensitiveData } from './crypto';
import { formatWhatsAppPhoneNumber } from './whatsapp';
// TODO(Phase 5): rewrite this store (Firebase only, per-record writes, HMAC phone index).
import {
  dbGet as getFirebaseData,
  dbSet as setFirebaseData,
  dbUpdate as updateFirebaseData,
  dbRemove as deleteFirebaseData,
  isFirebaseConfigured,
} from '@/lib/firebaseAdmin';

export interface StoredSubscriberRecord {
  id: string;
  phoneEncrypted: string;
  phoneHash: string; // SHA-256 of 10-digit phone for O(1) deduplication without decrypting
  nameEncrypted?: string;
  // Legacy optional fields for backward-compatibility migration during read
  phone?: string;
  formattedPhone?: string;
  customerName?: string;
  source: string;
  interestScore?: number;
  consentGiven: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageSentAt?: string;
  lastMessageStatus?: 'delivered' | 'sent' | 'failed' | 'pending';
  lastCampaignName?: string;
}

export interface DecryptedSubscriber {
  id: string;
  phone: string;
  formattedPhone: string;
  customerName: string;
  source: string;
  interestScore?: number;
  consentGiven: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageSentAt?: string;
  lastMessageStatus?: 'delivered' | 'sent' | 'failed' | 'pending';
  lastCampaignName?: string;
}

const SUBSCRIBERS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'whatsapp_subscribers.json');

// In-memory cache for fast lookups
let cachedSubscribers: StoredSubscriberRecord[] = [];
let isStoreInitialized = false;

function safeDecrypt(value: string): string {
  try {
    return decryptSensitiveData(value);
  } catch {
    return '';
  }
}

function hashPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '').slice(-10);
  return crypto.createHash('sha256').update(clean).digest('hex');
}

function readLocalFallback(): StoredSubscriberRecord[] {
  try {
    if (fs.existsSync(SUBSCRIBERS_FILE_PATH)) {
      const content = fs.readFileSync(SUBSCRIBERS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(content || '[]');
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[WhatsAppStore] Error reading local subscriber file:', err);
  }
  return [];
}

let lastReadTime = 0;
const CACHE_TTL_MS = 10000;

export async function readStoredSubscribers(forceFresh = false): Promise<StoredSubscriberRecord[]> {
  const now = Date.now();
  if (!forceFresh && isStoreInitialized && cachedSubscribers.length > 0 && now - lastReadTime < CACHE_TTL_MS) {
    return cachedSubscribers;
  }

  // 1. Fetch from Firebase Realtime Database
  if (isFirebaseConfigured()) {
    try {
      const remote = await getFirebaseData<any>('subscribers');
      if (remote) {
        const rawRecords: any[] = Array.isArray(remote)
          ? remote
          : Object.values(remote);
        const records: StoredSubscriberRecord[] = rawRecords.filter(
          (r): r is StoredSubscriberRecord => Boolean(r && typeof r === 'object' && r.id)
        );
        cachedSubscribers = records;
        isStoreInitialized = true;
        lastReadTime = now;
        return records;
      }
    } catch (fbErr) {
      console.warn('[WhatsAppStore] Firebase fetch warning:', fbErr);
    }
  }

  // 2. Fallback to local file or memory
  const local = readLocalFallback().filter(
    (r): r is StoredSubscriberRecord => Boolean(r && typeof r === 'object' && r.id)
  );
  cachedSubscribers = local;
  isStoreInitialized = true;
  lastReadTime = now;
  return local;
}

export function readStoredSubscribersSync(): StoredSubscriberRecord[] {
  if (isStoreInitialized && cachedSubscribers.length > 0) {
    return cachedSubscribers;
  }
  const local = readLocalFallback().filter(
    (r): r is StoredSubscriberRecord => Boolean(r && typeof r === 'object' && r.id)
  );
  cachedSubscribers = local;
  isStoreInitialized = true;
  return local;
}

export async function writeStoredSubscribers(records: StoredSubscriberRecord[]): Promise<void> {
  const sanitizedRecords = records
    .filter((r): r is StoredSubscriberRecord => Boolean(r && typeof r === 'object' && r.id))
    .map((r) => {
      // Strictly strip any cleartext phone numbers or customer names before storing
      const cleaned = { ...r };
      delete cleaned.phone;
      delete cleaned.formattedPhone;
      delete cleaned.customerName;
      return cleaned;
    });

  cachedSubscribers = sanitizedRecords;
  isStoreInitialized = true;

  // 1. Persist to Firebase Realtime Database
  if (isFirebaseConfigured()) {
    const recordsMap: Record<string, StoredSubscriberRecord> = {};
    for (const r of sanitizedRecords) {
      recordsMap[r.id] = r;
    }
    // Throws on failure so callers never report a save that did not happen.
    await setFirebaseData('subscribers', recordsMap);
  }

  // 2. Best-effort local file write for dev (skipped on serverless production)
  if (process.env.NODE_ENV !== 'production') {
    try {
      const dir = path.dirname(SUBSCRIBERS_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(SUBSCRIBERS_FILE_PATH, JSON.stringify(sanitizedRecords, null, 2), 'utf-8');
    } catch (err) {
      // Expected on read-only environments
    }
  }
}

/**
 * Adds or updates a subscriber with AES-256 encrypted PII storage and deduplication.
 * NEVER writes raw cleartext phone numbers or customer names to Firebase or disk.
 */
export async function addOrUpdateSubscriber(params: {
  phone: string;
  customerName?: string;
  source?: string;
  interestScore?: number;
}): Promise<DecryptedSubscriber> {
  const cleanPhone = params.phone.replace(/\D/g, '').slice(-10);
  const pHash = hashPhone(cleanPhone);
  const existingRecords = await readStoredSubscribers(true);

  const existingIndex = existingRecords.findIndex((r) => r.phoneHash === pHash);
  const now = new Date().toISOString();

  let targetRecord: StoredSubscriberRecord;

  if (existingIndex >= 0) {
    const prev = existingRecords[existingIndex];
    targetRecord = {
      ...prev,
      phoneEncrypted: encryptSensitiveData(cleanPhone),
      phoneHash: pHash,
      nameEncrypted: params.customerName
        ? encryptSensitiveData(params.customerName.trim())
        : prev.nameEncrypted,
      updatedAt: now,
      source: params.source || prev.source,
      interestScore: Math.max(prev.interestScore || 0, params.interestScore || 0),
    };
    // Strip cleartext fields from legacy records
    delete targetRecord.phone;
    delete targetRecord.formattedPhone;
    delete targetRecord.customerName;
    existingRecords[existingIndex] = targetRecord;
  } else {
    targetRecord = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      phoneEncrypted: encryptSensitiveData(cleanPhone),
      phoneHash: pHash,
      nameEncrypted: params.customerName ? encryptSensitiveData(params.customerName.trim()) : undefined,
      source: params.source || 'website_consent_prompt',
      interestScore: params.interestScore || 0,
      consentGiven: true,
      createdAt: now,
      updatedAt: now,
    };
    existingRecords.unshift(targetRecord);
  }

  // 1. Persist strictly encrypted records to Firebase RTDB
  if (isFirebaseConfigured()) {
    try {
      await setFirebaseData(`subscribers/${targetRecord.id}`, targetRecord);
      // Index by one-way SHA-256 hash (never cleartext phone) for fast deduplication lookup
      await setFirebaseData(`whatsapp_subscribers/${pHash}`, {
        id: targetRecord.id,
        phoneHash: pHash,
        phoneEncrypted: targetRecord.phoneEncrypted,
        nameEncrypted: targetRecord.nameEncrypted,
        source: targetRecord.source,
        interestScore: targetRecord.interestScore,
        consentGiven: true,
        updatedAt: now,
      });
      // Purge any legacy unencrypted cleartext path if it existed
      deleteFirebaseData(`whatsapp_subscribers/${cleanPhone}`).catch(() => {});
    } catch (fbErr) {
      console.warn('[WhatsAppStore] Failed to write subscriber to Firebase RTDB:', fbErr);
    }
  }

  // 2. Cache and sanitized local write
  cachedSubscribers = existingRecords;
  isStoreInitialized = true;
  lastReadTime = Date.now();
  if (process.env.NODE_ENV !== 'production') {
    try {
      const dir = path.dirname(SUBSCRIBERS_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(SUBSCRIBERS_FILE_PATH, JSON.stringify(existingRecords, null, 2), 'utf-8');
    } catch {}
  }

  const decrypted: DecryptedSubscriber = {
    id: targetRecord.id,
    phone: cleanPhone,
    formattedPhone: formatWhatsAppPhoneNumber(cleanPhone),
    customerName: params.customerName?.trim() || (targetRecord.nameEncrypted ? safeDecrypt(targetRecord.nameEncrypted) : ''),
    source: targetRecord.source,
    interestScore: targetRecord.interestScore,
    consentGiven: true,
    createdAt: targetRecord.createdAt,
    updatedAt: targetRecord.updatedAt,
    lastMessageSentAt: targetRecord.lastMessageSentAt,
    lastMessageStatus: targetRecord.lastMessageStatus,
    lastCampaignName: targetRecord.lastCampaignName,
  };

  return decrypted;
}

/**
 * Returns all subscribers with sensitive PII decrypted.
 * ONLY callable by authenticated Owner sessions.
 */
export async function getAllSubscribersDecrypted(): Promise<DecryptedSubscriber[]> {
  const records = await readStoredSubscribers();
  return records.map((r) => {
    let rawPhone = '';
    if (r.phoneEncrypted) {
      try {
        rawPhone = decryptSensitiveData(r.phoneEncrypted);
      } catch {}
    } else if (r.phone) {
      rawPhone = r.phone;
    }

    let rawName = '';
    if (r.nameEncrypted) {
      try {
        rawName = decryptSensitiveData(r.nameEncrypted);
      } catch {}
    } else if (r.customerName) {
      rawName = r.customerName;
    }

    return {
      id: r.id,
      phone: rawPhone,
      formattedPhone: rawPhone ? formatWhatsAppPhoneNumber(rawPhone) : '',
      customerName: rawName,
      source: r.source,
      interestScore: r.interestScore,
      consentGiven: r.consentGiven,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      lastMessageSentAt: r.lastMessageSentAt,
      lastMessageStatus: r.lastMessageStatus,
      lastCampaignName: r.lastCampaignName,
    };
  });
}

/**
 * Updates campaign dispatch results on subscriber records
 */
export async function updateCampaignDispatchStatus(
  subscriberIds: string[],
  campaignName: string,
  status: 'sent' | 'failed'
): Promise<void> {
  const records = await readStoredSubscribers(true);
  const idSet = new Set(subscriberIds);
  const now = new Date().toISOString();

  let modified = false;
  for (const r of records) {
    if (idSet.has(r.id)) {
      r.lastMessageSentAt = now;
      r.lastMessageStatus = status;
      r.lastCampaignName = campaignName;
      modified = true;
      if (isFirebaseConfigured()) {
        updateFirebaseData(`subscribers/${r.id}`, {
          lastMessageSentAt: now,
          lastMessageStatus: status,
          lastCampaignName: campaignName,
        }).catch(() => {});
      }
    }
  }

  if (modified) {
    cachedSubscribers = records;
    if (process.env.NODE_ENV !== 'production') {
      try {
        fs.writeFileSync(SUBSCRIBERS_FILE_PATH, JSON.stringify(records, null, 2), 'utf-8');
      } catch {}
    }
  }
}

/**
 * Deletes a subscriber by ID
 */
export async function deleteSubscriber(id: string): Promise<boolean> {
  const records = await readStoredSubscribers(true);
  const target = records.find((r) => r.id === id);
  const filtered = records.filter((r) => r.id !== id);
  if (filtered.length !== records.length) {
    cachedSubscribers = filtered;
    if (isFirebaseConfigured()) {
      try {
        await deleteFirebaseData(`subscribers/${id}`);
        if (target?.phoneHash) {
          await deleteFirebaseData(`whatsapp_subscribers/${target.phoneHash}`);
        }
        // Purge legacy path if applicable
        const legacyPhone = target?.phone || (target?.phoneEncrypted ? decryptSensitiveData(target.phoneEncrypted) : null);
        if (legacyPhone) {
          await deleteFirebaseData(`whatsapp_subscribers/${legacyPhone}`);
        }
      } catch (err) {
        console.warn('[WhatsAppStore] Firebase delete error:', err);
      }
    }
    if (process.env.NODE_ENV !== 'production') {
      try {
        fs.writeFileSync(SUBSCRIBERS_FILE_PATH, JSON.stringify(filtered, null, 2), 'utf-8');
      } catch {}
    }
    return true;
  }
  return false;
}
