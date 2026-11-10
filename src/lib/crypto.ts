import crypto from 'crypto';
import { getDataEncryptionKey } from './env';

/**
 * AES-256-GCM encryption for customer PII.
 *
 * The key is derived ONLY from DATA_ENCRYPTION_KEY (no hardcoded fallback and
 * no reuse of the session secret). Records written by older builds can still
 * be decrypted:
 *   - SHA-256(DATA_ENCRYPTION_KEY)            (pre-HKDF builds)
 *   - LEGACY_DATA_ENCRYPTION_SECRET (optional) with either derivation, for
 *     deployments whose old data was encrypted under a different secret.
 * Set LEGACY_DATA_ENCRYPTION_SECRET only until the re-encryption migration runs.
 */

const HKDF_SALT = 'spicy-garden-salt';
const HKDF_INFO = 'spicy-garden-pii-v1';

function hkdfKey(secret: string): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', secret, HKDF_SALT, HKDF_INFO, 32));
}

function sha256Key(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

function getMasterKey(): Buffer {
  return hkdfKey(getDataEncryptionKey());
}

function getDecryptionKeys(): Buffer[] {
  const primary = getDataEncryptionKey();
  const keys = [hkdfKey(primary), sha256Key(primary)];
  const legacy = process.env.LEGACY_DATA_ENCRYPTION_SECRET?.trim();
  if (legacy) keys.push(hkdfKey(legacy), sha256Key(legacy));
  return keys;
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

/**
 * Encrypts sensitive customer PII using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (base64 encoded)
 */
export function encryptSensitiveData(plainText: string): string {
  if (!plainText) return '';
  const key = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Decrypts a payload produced by encryptSensitiveData. Throws DecryptionError
 * when the payload is not ciphertext or cannot be authenticated with any key —
 * plaintext is never passed through as if it had been decrypted.
 */
export function decryptSensitiveData(encryptedPayload: string): string {
  if (!encryptedPayload) return '';

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3 || parts.some((p) => !p)) {
    throw new DecryptionError('Value is not an encrypted payload.');
  }
  const [ivB64, authTagB64, cipherTextB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(cipherTextB64, 'base64');

  for (const key of getDecryptionKeys()) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {
      // try next key
    }
  }
  throw new DecryptionError('Unable to decrypt value with any configured key.');
}

export { maskPhoneNumber } from './maskPhone';
