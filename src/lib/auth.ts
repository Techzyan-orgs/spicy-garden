export const OWNER_SESSION_COOKIE = 'sg_owner_session';

export function getOwnerEmail(): string {
  const email = process.env.OWNER_EMAIL;
  if (!email) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Auth Security] Notice: OWNER_EMAIL is not configured in environment variables. Using default owner address.');
    }
    return 'samudraganguly002017@gmail.com';
  }
  return email.trim().toLowerCase();
}

export function getSecretString(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret === 'spicy-garden-secure-session-secret-key-kolkata-700159') {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Auth Security] Notice: ADMIN_SESSION_SECRET should be set to a secure, non-default value in production environment variables.');
    }
    return 'spicy-garden-secure-session-secret-key-kolkata-700159';
  }
  return secret;
}

function base64UrlEncode(str: string): string {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function hmacSha256(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Validates owner credentials using cryptographic constant-time comparison.
 * Hashes inputs to equal 32-byte digests before comparing to prevent timing & length leaks.
 */
export async function verifyOwnerCredentials(email: string, password: string): Promise<boolean> {
  const configuredEmail = getOwnerEmail();
  const configuredPassword = process.env.OWNER_PASSWORD;

  if (process.env.NODE_ENV === 'production') {
    if (!configuredPassword || configuredPassword === 'spicygarden2024') {
      console.error('[Auth Security] Authentication denied: OWNER_PASSWORD is not set or uses default password in production.');
      return false;
    }
  }

  const effectivePassword = configuredPassword || 'spicygarden2024';

  if (!email || !password) return false;

  const inputEmail = email.trim().toLowerCase();

  const enc = new TextEncoder();
  const inEmailDigest = await crypto.subtle.digest('SHA-256', enc.encode(inputEmail));
  const confEmailDigest = await crypto.subtle.digest('SHA-256', enc.encode(configuredEmail));

  const inPassDigest = await crypto.subtle.digest('SHA-256', enc.encode(password));
  const confPassDigest = await crypto.subtle.digest('SHA-256', enc.encode(effectivePassword));

  let mismatch = 0;
  const inEmailBytes = new Uint8Array(inEmailDigest);
  const confEmailBytes = new Uint8Array(confEmailDigest);
  for (let i = 0; i < 32; i++) {
    mismatch |= inEmailBytes[i] ^ confEmailBytes[i];
  }

  const inPassBytes = new Uint8Array(inPassDigest);
  const confPassBytes = new Uint8Array(confPassDigest);
  for (let i = 0; i < 32; i++) {
    mismatch |= inPassBytes[i] ^ confPassBytes[i];
  }

  return mismatch === 0;
}

export async function createOwnerSessionToken(): Promise<string> {
  const now = Date.now();
  const payload = {
    role: 'admin',
    email: getOwnerEmail(),
    iat: now,
    exp: now + 24 * 60 * 60 * 1000, // 24 hours security limit
    nonce: Math.random().toString(36).substring(2) + now.toString(36),
  };

  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signature = await hmacSha256(payloadEncoded, getSecretString());
  return `${payloadEncoded}.${signature}`;
}

export async function verifyOwnerSessionToken(token?: string | null): Promise<boolean> {
  if (!token || !token.includes('.')) return false;

  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payloadEncoded, signature] = parts;
    if (!payloadEncoded || !signature) return false;

    const expectedSig = await hmacSha256(payloadEncoded, getSecretString());

    // Constant-time comparison
    if (signature.length !== expectedSig.length) return false;
    let mismatch = 0;
    for (let i = 0; i < signature.length; i++) {
      mismatch |= signature.charCodeAt(i) ^ expectedSig.charCodeAt(i);
    }
    if (mismatch !== 0) return false;

    const payload = JSON.parse(base64UrlDecode(payloadEncoded));
    if (payload.exp && Date.now() > payload.exp) return false;

    return payload.role === 'admin' && payload.email === getOwnerEmail();
  } catch {
    return false;
  }
}
