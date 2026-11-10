#!/usr/bin/env node
/**
 * One-time migration of WhatsApp subscribers to the Phase 5 format.
 *
 *  - Re-encrypts every phone/name with the CURRENT DATA_ENCRYPTION_KEY
 *    (old records may use the pre-HKDF key derivation, or an old secret given
 *    in LEGACY_DATA_ENCRYPTION_SECRET; cleartext legacy fields are encrypted).
 *  - Replaces the reversible SHA-256 phone hash with HMAC-SHA256(PHONE_HASH_KEY)
 *    and rebuilds the subscribers_by_hash/{hmac} → id index.
 *  - Imports entries that exist only in the legacy whatsapp_subscribers/* copy,
 *    then deletes whatsapp_subscribers entirely.
 *  - Marks records without recorded consent as consentVersion "legacy-unverified".
 *    Before Phase 5, every order/reservation subscribed the customer automatically,
 *    so those records have NO real opt-in. Use --drop-unconsented to delete them.
 *  - Optional --import-local: also imports src/data/whatsapp_subscribers.json
 *    (the old development fallback file) for numbers missing from Firebase.
 *
 * Usage:
 *   node scripts/migrate-subscribers.mjs                       # dry run (no writes)
 *   node scripts/migrate-subscribers.mjs --apply               # backup to ./.backups, then write
 *   node scripts/migrate-subscribers.mjs --apply --drop-unconsented --import-local
 *
 * Requires DATA_ENCRYPTION_KEY, PHONE_HASH_KEY (and LEGACY_DATA_ENCRYPTION_SECRET
 * if the old data was encrypted under a different secret). Records that cannot
 * be decrypted with any key are reported and left untouched.
 * The write is one atomic multi-path update. Safe to re-run.
 */
import crypto from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { connect, backup, APPLY } from './lib/firebase.mjs';

const DROP_UNCONSENTED = process.argv.includes('--drop-unconsented');
const IMPORT_LOCAL = process.argv.includes('--import-local');
/** Sources that were auto-subscribed (no checkbox) before Phase 5. */
const AUTO_SUBSCRIBED_SOURCES = new Set(['online_order', 'table_reservation']);

function requireEnv(name, min = 32) {
  const v = (process.env[name] || '').trim();
  if (v.length < min) {
    console.error(`✖ ${name} must be set (at least ${min} characters). See .env.example.`);
    process.exit(1);
  }
  return v;
}

const PRIMARY = requireEnv('DATA_ENCRYPTION_KEY');
const PHONE_HASH_KEY = requireEnv('PHONE_HASH_KEY');
const LEGACY = (process.env.LEGACY_DATA_ENCRYPTION_SECRET || '').trim();

const hkdf = (s) => Buffer.from(crypto.hkdfSync('sha256', s, 'spicy-garden-salt', 'spicy-garden-pii-v1', 32));
const sha = (s) => crypto.createHash('sha256').update(s).digest();
const ENC_KEY = hkdf(PRIMARY);
const DEC_KEYS = [hkdf(PRIMARY), sha(PRIMARY), ...(LEGACY ? [hkdf(LEGACY), sha(LEGACY)] : [])];

function encrypt(plain) {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${ct.toString('base64')}`;
}

function decrypt(payload) {
  if (!payload || typeof payload !== 'string') return null;
  const parts = payload.split(':');
  if (parts.length !== 3) return null;
  const [iv, tag, ct] = parts.map((p) => Buffer.from(p, 'base64'));
  for (const key of DEC_KEYS) {
    try {
      const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
      d.setAuthTag(tag);
      return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
    } catch {}
  }
  return null;
}

const digits = (p) => String(p ?? '').replace(/\D/g, '').slice(-10);
const hmac = (phone) => crypto.createHmac('sha256', PHONE_HASH_KEY).update(digits(phone)).digest('hex');
const valid = (phone) => /^[6-9]\d{9}$/.test(phone);
const newId = () => `sub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

const db = connect();
const [subsSnap, legacySnap] = await Promise.all([
  db.ref('subscribers').once('value'),
  db.ref('whatsapp_subscribers').once('value'),
]);
const subsRaw = subsSnap.val() || {};
const legacyRaw = legacySnap.val() || {};
const subs = Array.isArray(subsRaw) ? subsRaw.filter(Boolean) : Object.values(subsRaw);
const legacy = Object.entries(legacyRaw);

const report = { migrated: 0, importedLegacyCopy: 0, importedLocal: 0, undecryptable: [], dropped: 0, duplicatesMerged: 0 };
const byPhone = new Map(); // phone → record

function addRecord(rec, phone, name, origin) {
  if (!valid(phone)) {
    report.undecryptable.push(`${origin}:${rec.id ?? '?'}`);
    return;
  }
  const consented = Boolean(rec.consentVersion && rec.consentVersion !== 'legacy-unverified' && rec.consentAt);
  const autoSubscribed = !consented && AUTO_SUBSCRIBED_SOURCES.has(rec.source);
  if (autoSubscribed && DROP_UNCONSENTED) {
    report.dropped++;
    return;
  }
  const now = new Date().toISOString();
  const out = {
    id: rec.id && /^sub_[A-Za-z0-9_]{1,100}$/.test(rec.id) ? rec.id : newId(),
    phoneEncrypted: encrypt(phone),
    phoneHash: hmac(phone),
    ...(name ? { nameEncrypted: encrypt(name) } : {}),
    source: typeof rec.source === 'string' ? rec.source.slice(0, 50) : 'unknown',
    interestScore: Number.isFinite(rec.interestScore) ? rec.interestScore : 0,
    consentGiven: true,
    consentVersion: consented ? rec.consentVersion : 'legacy-unverified',
    ...(consented
      ? { consentAt: rec.consentAt, consentSource: rec.consentSource, consentText: rec.consentText }
      : {}),
    createdAt: rec.createdAt || now,
    updatedAt: now,
    ...(rec.lastMessageSentAt ? { lastMessageSentAt: rec.lastMessageSentAt } : {}),
    ...(rec.lastMessageStatus ? { lastMessageStatus: rec.lastMessageStatus } : {}),
    ...(rec.lastCampaignName ? { lastCampaignName: rec.lastCampaignName } : {}),
  };
  const existing = byPhone.get(phone);
  if (existing) {
    report.duplicatesMerged++;
    existing.interestScore = Math.max(existing.interestScore || 0, out.interestScore || 0);
    if (!existing.nameEncrypted && out.nameEncrypted) existing.nameEncrypted = out.nameEncrypted;
    return;
  }
  byPhone.set(phone, JSON.parse(JSON.stringify(out)));
  return true;
}

// 1. Main list
for (const rec of subs) {
  if (!rec || typeof rec !== 'object') continue;
  const phone = digits(decrypt(rec.phoneEncrypted) ?? rec.phone ?? '');
  const name = decrypt(rec.nameEncrypted) ?? (typeof rec.customerName === 'string' ? rec.customerName : '');
  if (addRecord(rec, phone, name, 'subscribers')) report.migrated++;
}

// 2. Legacy duplicate copy (only entries missing from the main list)
for (const [key, rec] of legacy) {
  if (!rec || typeof rec !== 'object') continue;
  const phone = digits(decrypt(rec.phoneEncrypted) ?? rec.phone ?? (/^\d{10}$/.test(key) ? key : ''));
  if (phone && byPhone.has(phone)) continue;
  const name = decrypt(rec.nameEncrypted) ?? (typeof rec.customerName === 'string' ? rec.customerName : '');
  if (addRecord(rec, phone, name, 'whatsapp_subscribers')) report.importedLegacyCopy++;
}

// 3. Optional: old local development file
const localFile = path.resolve('src', 'data', 'whatsapp_subscribers.json');
if (IMPORT_LOCAL && existsSync(localFile)) {
  const local = JSON.parse(readFileSync(localFile, 'utf8') || '[]');
  for (const rec of Array.isArray(local) ? local : []) {
    if (!rec || typeof rec !== 'object') continue;
    const phone = digits(decrypt(rec.phoneEncrypted) ?? rec.phone ?? '');
    if (phone && byPhone.has(phone)) continue;
    const name = decrypt(rec.nameEncrypted) ?? (typeof rec.customerName === 'string' ? rec.customerName : '');
    if (addRecord(rec, phone, name, 'local-file')) report.importedLocal++;
  }
} else if (existsSync(localFile)) {
  const local = JSON.parse(readFileSync(localFile, 'utf8') || '[]');
  const missing = (Array.isArray(local) ? local : []).filter((r) => {
    const p = digits(decrypt(r?.phoneEncrypted) ?? r?.phone ?? '');
    return p && !byPhone.has(p);
  }).length;
  console.log(`ℹ Local file ${path.relative(process.cwd(), localFile)}: ${missing} number(s) not in Firebase (use --import-local to import).`);
}

const records = [...byPhone.values()];
const bySource = {};
let unverified = 0;
for (const r of records) {
  bySource[r.source] = (bySource[r.source] || 0) + 1;
  if (r.consentVersion === 'legacy-unverified') unverified++;
}

console.log('\nSubscriber migration summary');
console.log(`  records after migration:         ${records.length}`);
console.log(`  from subscribers/*:              ${report.migrated}`);
console.log(`  imported from legacy copy:       ${report.importedLegacyCopy}`);
console.log(`  imported from local file:        ${report.importedLocal}`);
console.log(`  duplicates merged:               ${report.duplicatesMerged}`);
console.log(`  dropped (no recorded consent):   ${report.dropped}${DROP_UNCONSENTED ? '' : ' (pass --drop-unconsented to drop)'}`);
console.log(`  marked legacy-unverified:        ${unverified}`);
console.log(`  legacy whatsapp_subscribers/*:   ${legacy.length} → will be deleted`);
console.log('  by source:', bySource);
if (report.undecryptable.length) {
  console.log(`\n⚠ ${report.undecryptable.length} record(s) could not be decrypted with any key and are LEFT UNTOUCHED:`);
  console.log('  ', report.undecryptable.slice(0, 20).join(', '));
  console.log('  Set LEGACY_DATA_ENCRYPTION_SECRET to the old secret and re-run, or delete them manually.');
}

if (!APPLY) {
  console.log('\nDry run only. Re-run with --apply to write.');
  process.exit(0);
}

const file = backup('subscribers', { subscribers: subsRaw, whatsapp_subscribers: legacyRaw });
console.log(`\nBackup written to ${file}`);

// Keep undecryptable originals in place; everything else is rewritten.
const subsOut = {};
for (const rec of subs) {
  if (rec?.id && report.undecryptable.includes(`subscribers:${rec.id}`)) subsOut[rec.id] = rec;
}
const index = {};
for (const r of records) {
  subsOut[r.id] = r;
  index[r.phoneHash] = r.id;
}

// Legacy copy: delete every entry except ones we could not read (kept for manual review).
const keptLegacy = {};
for (const [key, rec] of legacy) {
  if (report.undecryptable.includes(`whatsapp_subscribers:${rec?.id ?? '?'}`)) keptLegacy[key] = rec;
}

await db.ref().update({
  subscribers: subsOut,
  subscribers_by_hash: index,
  whatsapp_subscribers: Object.keys(keptLegacy).length ? keptLegacy : null,
});
console.log(
  `✔ Wrote ${records.length} subscriber(s), rebuilt the index, ` +
    (Object.keys(keptLegacy).length
      ? `kept ${Object.keys(keptLegacy).length} unreadable legacy entr(y/ies) in whatsapp_subscribers.`
      : 'deleted whatsapp_subscribers.')
);
process.exit(0);
