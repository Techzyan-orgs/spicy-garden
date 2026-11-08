import crypto from 'crypto';

function getLegacyKey(): Buffer {
  const secret = process.env.DATA_ENCRYPTION_KEY || process.env.ADMIN_SESSION_SECRET || 'spicy-garden-dev-data-encryption-key-kolkata-700159';
  return crypto.createHash('sha256').update(secret).digest();
}

const getMasterKey = (): Buffer => {
  const secret = process.env.DATA_ENCRYPTION_KEY || process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Crypto Security] Warning: DATA_ENCRYPTION_KEY and ADMIN_SESSION_SECRET are missing in production. Using derived salt key.');
    }
    return Buffer.from(
      crypto.hkdfSync(
        'sha256',
        'spicy-garden-dev-data-encryption-key-kolkata-700159',
        'spicy-garden-salt',
        'spicy-garden-pii-v1',
        32
      )
    );
  }
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      secret,
      'spicy-garden-salt',
      'spicy-garden-pii-v1',
      32
    )
  );
};

/**
 * Encrypts sensitive customer PII using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (base64 encoded)
 */
export function encryptSensitiveData(plainText: string): string {
  if (!plainText) return '';
  try {
    const key = getMasterKey();
    const iv = crypto.randomBytes(12); // Standard 12 bytes IV for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
  } catch (err) {
    console.error('[Crypto] Encryption error:', err);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypts sensitive customer PII using AES-256-GCM.
 * Validates cryptographic authentication tag to prevent tampering.
 */
export function decryptSensitiveData(encryptedPayload: string): string {
  if (!encryptedPayload) return '';
  // If not encrypted (legacy or plain text during transition), return as is
  if (!encryptedPayload.includes(':')) {
    return encryptedPayload;
  }

  const [ivB64, authTagB64, cipherTextB64] = encryptedPayload.split(':');
  if (!ivB64 || !authTagB64 || !cipherTextB64) {
    return encryptedPayload;
  }

  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(cipherTextB64, 'base64');

  // 1. Try modern HKDF derived key
  try {
    const key = getMasterKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {}

  // 2. Fallback to legacy SHA-256 key for backward compatibility with pre-migration records
  try {
    const legacyKey = getLegacyKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', legacyKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('[Crypto] Decryption error (invalid key or corrupted data):', err);
    return '[Decryption Error]';
  }
}

/**
 * Masks phone number for display safety in the Admin UI (e.g. "98****3210")
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) {
    return `${clean.slice(0, 2)}****${clean.slice(6)}`;
  }
  if (clean.length > 4) {
    return `${clean.slice(0, 2)}****${clean.slice(-2)}`;
  }
  return '******';
}
