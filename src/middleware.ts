import { NextRequest, NextResponse } from 'next/server';
import { verifyOwnerSessionToken, OWNER_SESSION_COOKIE } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow login page and login API endpoint
  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return NextResponse.next();
  }

  const token = req.cookies.get(OWNER_SESSION_COOKIE)?.value;
  let isAuthenticated = false;
  try {
    isAuthenticated = await verifyOwnerSessionToken(token);
  } catch (err) {
    // Misconfigured secrets: fail closed, never treat as authenticated.
    console.error('[Middleware] Owner auth unavailable:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Owner portal unavailable: server is misconfigured.' },
      { status: 503 }
    );
  }

  // Guard API routes
  if (pathname.startsWith('/api/admin') || pathname.startsWith('/api/ably')) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'Unauthorized: Owner authentication required.' },
        { status: 401 }
      );
    }

    // CSRF protection on mutating admin API requests
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      const secFetchSite = req.headers.get('sec-fetch-site');
      if (secFetchSite === 'cross-site') {
        return NextResponse.json(
          { error: 'Forbidden: Cross-site mutation request rejected.' },
          { status: 403 }
        );
      }
      const origin = req.headers.get('origin');
      const host = req.headers.get('host');
      if (origin && host) {
        try {
          const originHost = new URL(origin).host;
          if (originHost !== host) {
            return NextResponse.json(
              { error: 'Forbidden: Origin mismatch.' },
              { status: 403 }
            );
          }
        } catch {}
      }
    }

    return NextResponse.next();
  }

  // Guard Admin Portal Pages
  if (pathname.startsWith('/admin')) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/admin/login', req.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/api/ably/:path*'],
};
