/**
 * Centralised, fail-closed access to configuration.
 *
 * Every getter throws a ConfigError when a required variable is missing or
 * invalid. There are deliberately NO hardcoded fallback values in this file:
 * a misconfigured deployment must refuse to operate rather than silently run
 * with a guessable secret.
 *
 * This module is Edge-runtime safe (no Node built-ins), so middleware can use it.
 */

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const KNOWN_INSECURE_VALUES = new Set([
  'spicy-garden-secure-session-secret-key-kolkata-700159',
  'spicy-garden-dev-data-encryption-key-kolkata-700159',
  'spicygarden2024',
  'changeme',
  'secret',
]);

function readVar(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireVar(name: string): string {
  const value = readVar(name);
  if (!value) {
    throw new ConfigError(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requireSecret(name: string, minLength = 32): string {
  const value = requireVar(name);
  if (value.length < minLength) {
    throw new ConfigError(`${name} must be at least ${minLength} characters long.`);
  }
  if (KNOWN_INSECURE_VALUES.has(value)) {
    throw new ConfigError(`${name} is set to a known default value. Generate a new random secret.`);
  }
  return value;
}

/** HMAC key used to sign owner session JWTs. */
export function getSessionSecret(): string {
  return requireSecret('ADMIN_SESSION_SECRET');
}

/** Master key for AES-256-GCM encryption of customer PII. Must differ from the session secret. */
export function getDataEncryptionKey(): string {
  const key = requireSecret('DATA_ENCRYPTION_KEY');
  if (key === readVar('ADMIN_SESSION_SECRET')) {
    throw new ConfigError('DATA_ENCRYPTION_KEY must be different from ADMIN_SESSION_SECRET.');
  }
  return key;
}

/** Owner login email (lower-cased). */
export function getOwnerEmail(): string {
  const email = requireVar('OWNER_EMAIL').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ConfigError('OWNER_EMAIL is not a valid email address.');
  }
  return email;
}

/**
 * Owner password hash produced by `node scripts/hash-password.mjs`.
 * Format: scrypt:<N>:<r>:<p>:<saltBase64>:<hashBase64>  (":" not "$", because .env loaders expand "$")
 */
export function getOwnerPasswordHash(): string {
  const hash = requireVar('OWNER_PASSWORD_HASH');
  if (!/^scrypt:\d+:\d+:\d+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(hash)) {
    throw new ConfigError(
      'OWNER_PASSWORD_HASH has an invalid format. Generate it with: node scripts/hash-password.mjs'
    );
  }
  return hash;
}
