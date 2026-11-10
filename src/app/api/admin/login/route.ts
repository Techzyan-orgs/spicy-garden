import { NextRequest, NextResponse } from 'next/server';
import { createOwnerSessionToken, OWNER_SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/auth';
import { verifyOwnerCredentials, getSessionVersion } from '@/lib/authServer';
import { ConfigError } from '@/lib/env';
import { DataUnavailableError } from '@/lib/firebaseAdmin';
import { consumeRateLimit, peekRateLimit, resetRateLimit } from '@/lib/rateLimit';
import { getClientIp, jsonError, parseBody } from '@/lib/apiGuard';
import { loginSchema } from '@/lib/schemas';

export const runtime = 'nodejs';

/** There is a single owner account, so the account-wide limiter uses a fixed key. */
const ACCOUNT_KEY = 'owner';

function tooMany(retryAfterSeconds: number): NextResponse {
  return jsonError(
    429,
    `Too many failed login attempts. Please wait ${retryAfterSeconds} seconds before trying again.`,
    undefined,
    { 'Retry-After': String(retryAfterSeconds) }
  );
}

/**
 * Owner login. Failed attempts are limited per IP (5 / 15 min) and across all
 * IPs for the owner account (20 / 15 min) using database-backed counters, so
 * the limits hold across every serverless instance and cold start.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    const [ipState, accountState] = await Promise.all([
      peekRateLimit('loginIp', ip),
      peekRateLimit('loginAccount', ACCOUNT_KEY),
    ]);
    if (!ipState.allowed || !accountState.allowed) {
      return tooMany(Math.max(ipState.retryAfterSeconds, accountState.retryAfterSeconds));
    }

    const parsed = await parseBody(req, loginSchema);
    if (!parsed.ok) return jsonError(400, 'Email and password are required.');
    const { email, password } = parsed.data;

    // Constant-time verification (prevents account enumeration)
    if (!verifyOwnerCredentials(email, password)) {
      await Promise.all([consumeRateLimit('loginIp', ip), consumeRateLimit('loginAccount', ACCOUNT_KEY)]);
      return jsonError(401, 'Invalid email or password. Please verify your credentials.');
    }

    // Successful login clears this IP's failures (the account-wide window simply expires).
    await resetRateLimit('loginIp', ip).catch(() => {});

    const token = await createOwnerSessionToken(await getSessionVersion());

    const response = NextResponse.json({ success: true, message: 'Owner authenticated successfully.' });
    response.cookies.set({
      name: OWNER_SESSION_COOKIE,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });
    return response;
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error('[Admin Login API] Server misconfiguration:', err.message);
      return jsonError(503, 'Owner login is not available: server is misconfigured.');
    }
    if (err instanceof DataUnavailableError) {
      console.error('[Admin Login API] Database unavailable:', err.message);
      return jsonError(503, 'Owner login is temporarily unavailable. Please try again shortly.', undefined, {
        'Retry-After': '30',
      });
    }
    console.error('[Admin Login API] Error:', err);
    return jsonError(500, 'An unexpected error occurred during login.');
  }
}
