export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyOwnerSessionToken, OWNER_SESSION_COOKIE } from '@/lib/auth';
import { generateAblyToken } from '@/lib/ably';

export async function GET(req: NextRequest) {
  // Protect Ably token generation - strictly accessible by authenticated owner
  const token = req.cookies.get(OWNER_SESSION_COOKIE)?.value;
  const isAuth = await verifyOwnerSessionToken(token);
  if (!isAuth) {
    return NextResponse.json({ error: 'Unauthorized: Owner session required.' }, { status: 401 });
  }

  const ablyAuth = await generateAblyToken();
  if (!ablyAuth) {
    return NextResponse.json({ error: 'Ably service is not available.' }, { status: 503 });
  }

  return NextResponse.json(ablyAuth);
}
