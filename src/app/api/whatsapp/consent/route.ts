import { NextRequest, NextResponse } from 'next/server';
import { addOrUpdateSubscriber } from '@/lib/whatsappStore';

export const dynamic = 'force-dynamic';

const consentRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkConsentRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = consentRateLimits.get(ip);
  if (!record || now > record.resetAt) {
    consentRateLimits.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  record.count += 1;
  return record.count <= 10;
}

export async function POST(req: NextRequest) {
  try {
    const clientIp =
      req.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('cf-connecting-ip')?.trim() ||
      req.headers.get('x-real-ip')?.trim() ||
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      '127.0.0.1';

    if (!checkConsentRateLimit(clientIp)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { phone, customerName, source, metadata } = body;

    const cleanPhone = (phone || '').replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return NextResponse.json(
        { error: 'Valid 10-digit mobile number required (starting with 6-9).' },
        { status: 400 }
      );
    }

    const sanitizedName = customerName ? String(customerName).trim().slice(0, 100) : undefined;
    const sanitizedSource = source ? String(source).trim().slice(0, 50) : 'behavioral_interest_prompt';

    const saved = await addOrUpdateSubscriber({
      phone: cleanPhone,
      customerName: sanitizedName,
      source: sanitizedSource,
      interestScore: metadata?.interestScore ? Math.min(1000, Number(metadata.interestScore)) : undefined,
    });

    return NextResponse.json({
      success: true,
      subscriberId: saved.id,
      message: 'WhatsApp preferences and consent saved securely.',
    });
  } catch (err: any) {
    console.error('[WhatsApp Consent API] Error processing consent:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to save consent.' },
      { status: 500 }
    );
  }
}
