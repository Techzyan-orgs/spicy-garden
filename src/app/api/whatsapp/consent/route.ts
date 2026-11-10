import { NextRequest, NextResponse } from 'next/server';
import { addOrUpdateSubscriber } from '@/lib/whatsappStore';
import { enforceRateLimit, getClientIp, jsonError, parseBody } from '@/lib/apiGuard';
import { storeErrorResponse } from '@/lib/apiErrors';
import { consentSchema, INDIAN_MOBILE, normalizePhone } from '@/lib/schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const limited = await enforceRateLimit('consent', getClientIp(req));
    if (limited) return limited;

    const parsed = await parseBody(req, consentSchema);
    if (!parsed.ok) return parsed.response;
    const { phone, customerName, source, metadata } = parsed.data;

    const cleanPhone = normalizePhone(phone);
    if (!INDIAN_MOBILE.test(cleanPhone)) {
      return jsonError(400, 'Valid 10-digit mobile number required (starting with 6-9).');
    }

    const saved = await addOrUpdateSubscriber({
      phone: cleanPhone,
      customerName,
      source: source || 'behavioral_interest_prompt',
      interestScore: metadata?.interestScore,
    });

    return NextResponse.json({
      success: true,
      subscriberId: saved.id,
      message: 'WhatsApp preferences and consent saved securely.',
    });
  } catch (err) {
    return storeErrorResponse(err, 'WhatsApp Consent API', 'Failed to save consent.');
  }
}
