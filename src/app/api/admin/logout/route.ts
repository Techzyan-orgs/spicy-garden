import { NextResponse } from 'next/server';
import { OWNER_SESSION_COOKIE } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully.' });
  response.cookies.delete(OWNER_SESSION_COOKIE);
  return response;
}
