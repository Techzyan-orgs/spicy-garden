/**
 * WhatsApp marketing subscribers — Firebase RTDB only (no local files).
 *
 * Layout:
 *   subscribers/{id}                 encrypted record (phone + name AES-256-GCM)
 *   subscribers_by_hash/{hmac}       → id   (HMAC-SHA256(PHONE_HASH_KEY, phone))
 *
 * Every write is per-record (atomic multi-path update) and throws on failure.
 * Records are only created with explicit, recorded consent; unsubscribing
 * deletes the record.
 *
 * Legacy compatibility (until scripts/migrate-subscribers.mjs has run):
 * records may still carry an unsalted SHA-256 `phoneHash`, and a duplicate
 * copy may exist under whatsapp_subscribers/{sha256}. Lookups fall back to a
 * scan matching either hash; writes upgrade the record and delete the copy.
 *
 * Node runtime only.
 */
import crypto from 'crypto';
import { encryptSensitiveData, decryptSensitiveData } from './crypto';
import { formatWhatsAppPhoneNumber } from './whatsapp';
import { dbGet, dbUpdate } from './firebaseAdmin';
import { getPhoneHashKey } from './env';
import { WHATSAPP_CONSENT_TEXT, WHATSAPP_CONSENT_VERSION } from './consentText';

export interface StoredSubscriberRecord {
  id: string;
  phoneEncrypted: string;
  /** HMAC-SHA256 of the 10-digit phone (legacy records: unsalted SHA-256). */
  phoneHash: string;
  nameEncrypted?: string;
  source: string;
  interestScore?: number;
  consentGiven: boolean;
  consentAt?: string;
  consentSource?: string;
  consentVersion?: string;
  consentText?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageSentAt?: string;
  lastMessageStatus?: 'delivered' | 'sent' | 'failed' | 'pending';
  lastCampaignName?: string;
  // Legacy cleartext fields (stripped on any write)
  phone?: string;
  formattedPhone?: string;
  customerName?: string;
}

export interface DecryptedSubscriber {
  id: string;
  phone: string;
  formattedPhone: string;
  customerName: string;
  source: string;
  interestScore?: number;
  consentGiven: boolean;
  consentAt?: string;
  consentVersion?: string;
  createdAt: string;
  updatedAt: string;
  lastMessageSentAt?: string;
  lastMessageStatus?: 'delivered' | 'sent' | 'failed' | 'pending';
  lastCampaignName?: string;
}

const CACHE_TTL_MS = 10_000;
let cache: { records: StoredSubscriberRecord[]; at: number } | null = null;

function invalidateCache() {
  cache = null;
}

export function normalizeSubscriberPhone(phone: string): string {
  return String(phone ?? '').replace(/\D/g, '').slice(-10);
}

/** Keyed, non-reversible phone index key. */
export function phoneHmac(phone: string): string {
  return crypto.createHmac('sha256', getPhoneHashKey()).update(normalizeSubscriberPhone(phone)).digest('hex');
}

/** Legacy unsalted hash, used only to find and clean up pre-migration records. */
function legacyPhoneHash(phone: string): string {
  return crypto.createHash('sha256').update(normalizeSubscriberPhone(phone)).digest('hex');
}

function safeDecrypt(value: string | undefined): string {
  if (!value) return '';
  try {
    return decryptSensitiveData(value);
  } catch {
    return '';
  }
}

function isRecord(r: unknown): r is StoredSubscriberRecord {
  return Boolean(r && typeof r === 'object' && typeof (r as StoredSubscriberRecord).id === 'string');
}

/** All stored (encrypted) records. Throws DataUnavailableError when the database cannot be read. */
export async function readStoredSubscribers(forceFresh = false): Promise<StoredSubscriberRecord[]> {
  if (!forceFresh && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.records;
  const remote = await dbGet<Record<string, unknown> | unknown[]>('subscribers');
  const raw = remote ? (Array.isArray(remote) ? remote : Object.values(remote)) : [];
  const records = raw.filter(isRecord).sort((a, b) => a.id.localeCompare(b.id));
  cache = { records, at: Date.now() };
  return records;
}

async function findByPhone(phone: string): Promise<StoredSubscriberRecord | null> {
  const hmac = phoneHmac(phone);
  const indexedId = await dbGet<string>(`subscribers_by_hash/${hmac}`);
  if (typeof indexedId === 'string') {
    const rec = await dbGet<StoredSubscriberRecord>(`subscribers/${indexedId}`);
    if (isRecord(rec)) return rec;
  }
  // Fallback for records not yet migrated to the HMAC index.
  const legacy = legacyPhoneHash(phone);
  const all = await readStoredSubscribers(true);
  return all.find((r) => r.phoneHash === hmac || r.phoneHash === legacy) ?? null;
}

function toDecrypted(r: StoredSubscriberRecord, phoneHint?: string, nameHint?: string): DecryptedSubscriber {
  const phone = phoneHint || safeDecrypt(r.phoneEncrypted) || r.phone || '';
  return {
    id: r.id,
    phone,
    formattedPhone: phone ? formatWhatsAppPhoneNumber(phone) : '',
    customerName: nameHint || safeDecrypt(r.nameEncrypted) || r.customerName || '',
    source: r.source,
    interestScore: r.interestScore,
    consentGiven: r.consentGiven,
    consentAt: r.consentAt,
    consentVersion: r.consentVersion,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    lastMessageSentAt: r.lastMessageSentAt,
    lastMessageStatus: r.lastMessageStatus,
    lastCampaignName: r.lastCampaignName,
  };
}

export interface ConsentEvidence {
  /** Where the customer opted in, e.g. "order_checkout", "behavioral_interest_prompt", "admin_manual". */
  source: string;
  /** Wording shown to the customer; defaults to the current standard text. */
  text?: string;
  version?: string;
}

/**
 * Adds or updates a subscriber. Requires explicit consent evidence, which is
 * stored with the record. Never writes cleartext phone numbers or names.
 */
export async function addOrUpdateSubscriber(params: {
  phone: string;
  customerName?: string;
  source?: string;
  interestScore?: number;
  consent: ConsentEvidence;
}): Promise<DecryptedSubscriber> {
  const cleanPhone = normalizeSubscriberPhone(params.phone);
  const hmac = phoneHmac(cleanPhone);
  const existing = await findByPhone(cleanPhone);
  const now = new Date().toISOString();
  const name = params.customerName?.trim().slice(0, 100) || '';

  const record: StoredSubscriberRecord = {
    ...(existing ?? {}),
    id: existing?.id ?? `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    phoneEncrypted: encryptSensitiveData(cleanPhone),
    phoneHash: hmac,
    nameEncrypted: name ? encryptSensitiveData(name) : existing?.nameEncrypted,
    source: params.source || existing?.source || params.consent.source,
    interestScore: Math.max(existing?.interestScore || 0, params.interestScore || 0),
    consentGiven: true,
    consentAt: now,
    consentSource: params.consent.source,
    consentVersion: params.consent.version || WHATSAPP_CONSENT_VERSION,
    consentText: params.consent.text || WHATSAPP_CONSENT_TEXT,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  delete record.phone;
  delete record.formattedPhone;
  delete record.customerName;
  // RTDB rejects undefined values
  const clean = JSON.parse(JSON.stringify(record)) as StoredSubscriberRecord;

  const updates: Record<string, unknown> = {
    [`subscribers/${clean.id}`]: clean,
    [`subscribers_by_hash/${hmac}`]: clean.id,
    // Remove the legacy duplicate copy (unsalted hash / cleartext key), if any.
    [`whatsapp_subscribers/${legacyPhoneHash(cleanPhone)}`]: null,
    [`whatsapp_subscribers/${cleanPhone}`]: null,
  };
  await dbUpdate('', updates);
  invalidateCache();

  return toDecrypted(clean, cleanPhone, name || undefined);
}

/** Deletes a subscriber record and all its index entries. */
async function removeRecord(rec: StoredSubscriberRecord): Promise<void> {
  const phone = safeDecrypt(rec.phoneEncrypted) || rec.phone || '';
  const updates: Record<string, unknown> = { [`subscribers/${rec.id}`]: null };
  if (rec.phoneHash) {
    updates[`subscribers_by_hash/${rec.phoneHash}`] = null;
    updates[`whatsapp_subscribers/${rec.phoneHash}`] = null;
  }
  if (phone) {
    updates[`subscribers_by_hash/${phoneHmac(phone)}`] = null;
    updates[`whatsapp_subscribers/${legacyPhoneHash(phone)}`] = null;
    updates[`whatsapp_subscribers/${normalizeSubscriberPhone(phone)}`] = null;
  }
  await dbUpdate('', updates);
  invalidateCache();
}

/** Owner action: delete by subscriber id. Returns false when not found. */
export async function deleteSubscriber(id: string): Promise<boolean> {
  const rec = await dbGet<StoredSubscriberRecord>(`subscribers/${id}`);
  if (!isRecord(rec)) return false;
  await removeRecord(rec);
  return true;
}

/** Customer opt-out by phone number. Returns false when the number was not subscribed. */
export async function unsubscribeByPhone(phone: string): Promise<boolean> {
  const rec = await findByPhone(phone);
  if (!rec) return false;
  await removeRecord(rec);
  return true;
}

/** All subscribers with PII decrypted. Owner-only callers. */
export async function getAllSubscribersDecrypted(): Promise<DecryptedSubscriber[]> {
  const records = await readStoredSubscribers();
  return records.map((r) => toDecrypted(r));
}

/** Records campaign results on the given subscribers (one atomic update). */
export async function updateCampaignDispatchStatus(
  subscriberIds: string[],
  campaignName: string,
  status: 'sent' | 'failed'
): Promise<void> {
  if (subscriberIds.length === 0) return;
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {};
  for (const id of subscriberIds) {
    updates[`subscribers/${id}/lastMessageSentAt`] = now;
    updates[`subscribers/${id}/lastMessageStatus`] = status;
    updates[`subscribers/${id}/lastCampaignName`] = campaignName.slice(0, 120);
  }
  await dbUpdate('', updates);
  invalidateCache();
}
