export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/authServer';

/**
 * Serverless SSE Proxy deprecation notice.
 * Live real-time streams connect directly from browser client using scoped tokens from /api/ably/token.
 * This eliminates Vercel serverless execution limits and prevents 504 timeouts.
 */
export async function GET(req: NextRequest) {
  const isAuth = await isAdminRequest(req);
  if (!isAuth) {
    return NextResponse.json({ error: 'Unauthorized: Owner session required.' }, { status: 401 });
  }

  return NextResponse.json({
    status: 'deprecated',
    message: 'Serverless SSE proxying is disabled to eliminate Vercel function timeout limits. Use /api/ably/token for direct Ably streaming.',
  });
}
