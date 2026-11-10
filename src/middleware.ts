import { NextRequest, NextResponse } from 'next/server';
import { verifyOwnerSessionToken, OWNER_SESSION_COOKIE } from '@/lib/auth';

/**
 * Edge middleware:
 *  1. Same-origin check on EVERY state-changing /api request (CSRF / cross-site
 *     form posts), public or admin.
 *  2. Owner session (JWT signature + expiry) for /admin pages and /api/admin,
 *     /api/ably. Route handlers additionally verify the server-side session
 *     version via requireAdmin(), which the Edge runtime cannot reach.
 */
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function crossSiteRejection(req: NextRequest): NextResponse | null {
  if (!MUTATING.has(req.method)) return null;

  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') {
    return NextResponse.json({ error: 'Forbidden: Cross-site request rejected.' }, { status: 403 });
  }

  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (origin && host) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null; // e.g. "null" origin from sandboxed frames
    }
    if (originHost !== host) {
      return NextResponse.json({ error: 'Forbidden: Origin mismatch.' }, { status: 403 });
    }
  }
  return null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');

  if (isApi) {
    const rejected = crossSiteRejection(req);
    if (rejected) return rejected;
  }

  const needsOwner =
    (pathname.startsWith('/admin') && pathname !== '/admin/login') ||
    (pathname.startsWith('/api/admin') && pathname !== '/api/admin/login') ||
    pathname.startsWith('/api/ably');

  if (!needsOwner) return NextResponse.next();

  let isAuthenticated = false;
  try {
    isAuthenticated = await verifyOwnerSessionToken(req.cookies.get(OWNER_SESSION_COOKIE)?.value);
  } catch (err) {
    // Misconfigured secrets: fail closed, never treat as authenticated.
    console.error('[Middleware] Owner auth unavailable:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Owner portal unavailable: server is misconfigured.' }, { status: 503 });
  }

  if (isAuthenticated) return NextResponse.next();

  if (isApi) {
    return NextResponse.json({ error: 'Unauthorized: Owner authentication required.' }, { status: 401 });
  }
  const loginUrl = new URL('/admin/login', req.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};
