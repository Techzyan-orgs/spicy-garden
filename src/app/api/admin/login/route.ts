import { NextRequest, NextResponse } from 'next/server';
import {
  verifyOwnerCredentials,
  createOwnerSessionToken,
  OWNER_SESSION_COOKIE,
} from '@/lib/auth';

import crypto from 'crypto';
import {
  isFirebaseConfigured,
  getFirebaseData,
  setFirebaseData,
  deleteFirebaseData,
} from '@/lib/firebaseRtdb';

interface LoginAttemptRecord {
  count: number;
  lockedUntil: number;
  updatedAt: number;
}

// In-memory sliding window rate limiter: max 5 failed attempts per 15 minutes per IP
const loginAttempts = new Map<string, LoginAttemptRecord>();

function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

function getClientIp(req: NextRequest): string {
  // Prioritize verified hosting headers
  const vercelIp = req.headers.get('x-vercel-forwarded-for');
  if (vercelIp) return vercelIp.split(',')[0].trim();
  const cfIp = req.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return '127.0.0.1';
}

async function checkRateLimit(ip: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = Date.now();
  let record = loginAttempts.get(ip);

  // Cross-serverless instance sync via Firebase Realtime Database
  if (!record && isFirebaseConfigured()) {
    try {
      const fbRecord = await getFirebaseData<LoginAttemptRecord>(
        `security/login_attempts/${hashIp(ip)}`
      );
      if (fbRecord) {
        record = fbRecord;
        loginAttempts.set(ip, record);
      }
    } catch {}
  }

  if (!record) return { allowed: true, retryAfterSeconds: 0 };

  // Expire stale failed attempts older than 15 minutes window
  if (record.updatedAt && now - record.updatedAt > 15 * 60 * 1000 && record.lockedUntil <= now) {
    loginAttempts.delete(ip);
    if (isFirebaseConfigured()) {
      deleteFirebaseData(`security/login_attempts/${hashIp(ip)}`).catch(() => {});
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (record.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((record.lockedUntil - now) / 1000),
    };
  }

  if (now > record.lockedUntil && record.lockedUntil !== 0) {
    loginAttempts.delete(ip);
    if (isFirebaseConfigured()) {
      deleteFirebaseData(`security/login_attempts/${hashIp(ip)}`).catch(() => {});
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

async function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const record: LoginAttemptRecord = loginAttempts.get(ip) || { count: 0, lockedUntil: 0, updatedAt: now };
  if (record.updatedAt && now - record.updatedAt > 15 * 60 * 1000 && record.lockedUntil <= now) {
    record.count = 0;
  }
  record.count += 1;
  record.updatedAt = now;

  if (record.count >= 5) {
    // Lock for 15 minutes
    record.lockedUntil = now + 15 * 60 * 1000;
  }
  loginAttempts.set(ip, record);

  if (isFirebaseConfigured()) {
    setFirebaseData(`security/login_attempts/${hashIp(ip)}`, record).catch(() => {});
  }
}

async function clearFailedAttempts(ip: string) {
  loginAttempts.delete(ip);
  if (isFirebaseConfigured()) {
    deleteFirebaseData(`security/login_attempts/${hashIp(ip)}`).catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const { allowed, retryAfterSeconds } = await checkRateLimit(ip);

    if (!allowed) {
      return NextResponse.json(
        {
          error: `Too many failed login attempts. Please wait ${retryAfterSeconds} seconds before trying again.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSeconds) },
        }
      );
    }

    const body = await req.json();
    const { email, password } = body;

    const trimmedEmail = (email || '').trim().toLowerCase();

    if (!trimmedEmail || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    // Unified verification in constant time (prevents account enumeration)
    const isValid = await verifyOwnerCredentials(trimmedEmail, password);
    if (!isValid) {
      await recordFailedAttempt(ip);
      return NextResponse.json(
        { error: 'Invalid email or password. Please verify your credentials.' },
        { status: 401 }
      );
    }

    // Clear failed attempts on successful login
    await clearFailedAttempts(ip);

    const token = await createOwnerSessionToken();

    const response = NextResponse.json({
      success: true,
      message: 'Owner authenticated successfully.',
    });

    response.cookies.set({
      name: OWNER_SESSION_COOKIE,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (err: any) {
    console.error('[Admin Login API] Error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred during login.' },
      { status: 500 }
    );
  }
}
