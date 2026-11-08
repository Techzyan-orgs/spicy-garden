export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyOwnerSessionToken, OWNER_SESSION_COOKIE } from '@/lib/auth';

/**
 * Serverless SSE Proxy deprecation notice.
 * Live real-time streams connect directly from browser client using scoped tokens from /api/ably/token.
 * This eliminates Vercel serverless execution limits and prevents 504 timeouts.
 */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(OWNER_SESSION_COOKIE)?.value;
  const isAuth = await verifyOwnerSessionToken(token);
  if (!isAuth) {
    return NextResponse.json({ error: 'Unauthorized: Owner session required.' }, { status: 401 });
  }

  return NextResponse.json({
    status: 'deprecated',
    message: 'Serverless SSE proxying is disabled to eliminate Vercel function timeout limits. Use /api/ably/token for direct Ably streaming.',
  });
}
