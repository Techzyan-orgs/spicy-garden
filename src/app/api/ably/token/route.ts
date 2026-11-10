export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiGuard';
import { generateAblyToken } from '@/lib/ably';

export async function GET(req: NextRequest) {
  // Protect Ably token generation - strictly accessible by authenticated owner
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const ablyAuth = await generateAblyToken();
  if (!ablyAuth) {
    return NextResponse.json({ error: 'Ably service is not available.' }, { status: 503 });
  }

  return NextResponse.json(ablyAuth);
}
