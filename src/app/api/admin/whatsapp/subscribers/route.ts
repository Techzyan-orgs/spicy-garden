import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, jsonError } from '@/lib/apiGuard';
import { INDIAN_MOBILE, normalizePhone, subscriberIdSchema } from '@/lib/schemas';
import {
  getAllSubscribersDecrypted,
  addOrUpdateSubscriber,
  deleteSubscriber,
} from '@/lib/whatsappStore';
import { isWhatsAppConfigured } from '@/lib/whatsapp';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const subscribers = await getAllSubscribersDecrypted();
    const today = new Date().toISOString().split('T')[0];
    const todayCount = subscribers.filter((s) => s.createdAt.startsWith(today)).length;

    // Find latest campaign across subscribers
    const lastCampaignEntry = subscribers
      .filter((s) => Boolean(s.lastMessageSentAt))
      .sort((a, b) => new Date(b.lastMessageSentAt!).getTime() - new Date(a.lastMessageSentAt!).getTime())[0];

    return NextResponse.json({
      subscribers,
      stats: {
        total: subscribers.length,
        addedToday: todayCount,
        lastBroadcastAt: lastCampaignEntry?.lastMessageSentAt || null,
        lastBroadcastCampaign: lastCampaignEntry?.lastCampaignName || null,
        isApiConfigured: isWhatsAppConfigured(),
      },
    });
  } catch (err: any) {
    console.error('[Admin WhatsApp API] Error fetching subscribers:', err);
    return NextResponse.json({ error: 'Failed to fetch subscribers' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return jsonError(400, 'Request body must be valid JSON.');

    const cleanPhone = normalizePhone(typeof body.phone === 'string' ? body.phone : '');
    if (!INDIAN_MOBILE.test(cleanPhone)) {
      return jsonError(400, 'Valid 10-digit mobile number required (starting with 6-9).');
    }
    const customerName = typeof body.customerName === 'string' ? body.customerName.trim().slice(0, 100) : '';
    const source =
      typeof body.source === 'string' && /^[a-z0-9_]{1,50}$/.test(body.source) ? body.source : undefined;

    const saved = await addOrUpdateSubscriber({
      phone: cleanPhone,
      customerName: customerName || undefined,
      source: source || 'manual_admin_entry',
      interestScore: 100, // Explicitly added by owner
      // The owner attests the customer agreed to receive WhatsApp offers.
      consent: { source: 'admin_manual', text: 'Added by the owner after the customer agreed to receive WhatsApp offers.' },
    });

    return NextResponse.json({ success: true, subscriber: saved });
  } catch (err: any) {
    console.error('[Admin WhatsApp API] Error creating subscriber:', err);
    return NextResponse.json({ error: 'Failed to save subscriber' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id || !subscriberIdSchema.safeParse(id).success) {
      return jsonError(400, 'A valid subscriber ID is required.');
    }

    const removed = await deleteSubscriber(id);
    if (!removed) {
      return NextResponse.json({ error: 'Subscriber not found.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[Admin WhatsApp API] Error deleting subscriber:', err);
    return NextResponse.json({ error: 'Failed to delete subscriber' }, { status: 500 });
  }
}
