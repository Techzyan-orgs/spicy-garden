import { NextRequest, NextResponse } from 'next/server';
import { unsubscribeByPhone } from '@/lib/whatsappStore';
import { enforceRateLimit, getClientIp, jsonError, parseBody } from '@/lib/apiGuard';
import { storeErrorResponse } from '@/lib/apiErrors';
import { INDIAN_MOBILE, normalizePhone, unsubscribeSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/whatsapp/unsubscribe { phone }
 * Removes the number from the WhatsApp offers list (the record is deleted).
 * Always answers the same way, so the endpoint cannot be used to discover
 * whether a number is subscribed.
 */
export async function POST(req: NextRequest) {
  try {
    const limited = await enforceRateLimit('unsubscribe', getClientIp(req));
    if (limited) return limited;

    const parsed = await parseBody(req, unsubscribeSchema);
    if (!parsed.ok) return parsed.response;

    const phone = normalizePhone(parsed.data.phone);
    if (!INDIAN_MOBILE.test(phone)) {
      return jsonError(400, 'Please enter a valid 10-digit mobile number.');
    }

    await unsubscribeByPhone(phone);
    return NextResponse.json(
      {
        success: true,
        message: 'If this number was subscribed, it has been removed. You will not receive further offers on WhatsApp.',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return storeErrorResponse(err, 'WhatsApp Unsubscribe API', 'Could not process your request. Please try again.');
  }
}
