/**
 * Owner session tokens (Edge-runtime safe).
 *
 * Sessions are HS256 JWTs signed with ADMIN_SESSION_SECRET. Middleware only
 * verifies signature + expiry here; route handlers additionally check the
 * server-side session version (see authServer.ts) so sessions can be revoked.
 */
import { SignJWT, jwtVerify } from 'jose';
import { getOwnerEmail, getSessionSecret } from './env';

export const OWNER_SESSION_COOKIE = 'sg_owner_session';
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours

const ISSUER = 'spicy-garden';
const AUDIENCE = 'spicy-garden-admin';

export interface OwnerSessionClaims {
  email: string;
  role: 'admin';
  /** Session version; must match the value stored in the database. */
  sv: number;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getSessionSecret());
}

export async function createOwnerSessionToken(sessionVersion: number): Promise<string> {
  return new SignJWT({ role: 'admin', sv: sessionVersion })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(getOwnerEmail())
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

/**
 * Verifies signature, expiry, issuer/audience and owner identity.
 * Returns the claims, or null for any invalid token. Throws ConfigError if the
 * server is misconfigured (callers must not treat that as "authenticated").
 */
export async function decodeOwnerSessionToken(token?: string | null): Promise<OwnerSessionClaims | null> {
  if (!token) return null;
  const key = secretKey(); // throws ConfigError when misconfigured — never swallowed below
  const ownerEmail = getOwnerEmail();
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (payload.role !== 'admin' || payload.sub !== ownerEmail) return null;
    if (typeof payload.sv !== 'number' || !Number.isInteger(payload.sv)) return null;
    return { email: payload.sub, role: 'admin', sv: payload.sv };
  } catch {
    return null;
  }
}

/** Signature/expiry-only check, for Edge middleware. */
export async function verifyOwnerSessionToken(token?: string | null): Promise<boolean> {
  return (await decodeOwnerSessionToken(token)) !== null;
}
