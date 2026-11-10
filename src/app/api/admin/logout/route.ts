import { NextRequest, NextResponse } from 'next/server';
import { OWNER_SESSION_COOKIE } from '@/lib/auth';
import { isAdminRequest, revokeAllOwnerSessions } from '@/lib/authServer';

export const runtime = 'nodejs';

/**
 * POST /api/admin/logout            → clears this browser's session cookie
 * POST /api/admin/logout?all=1      → also revokes every session on every device
 */
export async function POST(req: NextRequest) {
  const revokeAll = req.nextUrl.searchParams.get('all') === '1';

  if (revokeAll) {
    if (!(await isAdminRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
      await revokeAllOwnerSessions();
    } catch (err) {
      console.error('[Admin Logout API] Failed to revoke sessions:', err);
      return NextResponse.json({ error: 'Could not revoke sessions. Please try again.' }, { status: 503 });
    }
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  response.cookies.set({
    name: OWNER_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}
