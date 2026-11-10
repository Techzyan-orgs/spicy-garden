export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/authServer';
import { generateAblyToken } from '@/lib/ably';

export async function GET(req: NextRequest) {
  // Protect Ably token generation - strictly accessible by authenticated owner
  const isAuth = await isAdminRequest(req);
  if (!isAuth) {
    return NextResponse.json({ error: 'Unauthorized: Owner session required.' }, { status: 401 });
  }

  const ablyAuth = await generateAblyToken();
  if (!ablyAuth) {
    return NextResponse.json({ error: 'Ably service is not available.' }, { status: 503 });
  }

  return NextResponse.json(ablyAuth);
}
