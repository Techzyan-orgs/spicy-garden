import { NextRequest, NextResponse } from 'next/server';
import { verifyOwnerSessionToken, OWNER_SESSION_COOKIE } from '@/lib/auth';
import {
  getAllSubscribersDecrypted,
  addOrUpdateSubscriber,
  deleteSubscriber,
} from '@/lib/whatsappStore';
import { isWhatsAppConfigured } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

async function checkAdminAuth(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(OWNER_SESSION_COOKIE)?.value;
  return await verifyOwnerSessionToken(token);
}

export async function GET(req: NextRequest) {
  if (!(await checkAdminAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  if (!(await checkAdminAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { phone, customerName, source } = body;

    const cleanPhone = phone?.replace(/\D/g, '') || '';
    if (cleanPhone.length < 10) {
      return NextResponse.json(
        { error: 'Valid 10-digit mobile number required.' },
        { status: 400 }
      );
    }

    const saved = await addOrUpdateSubscriber({
      phone: cleanPhone,
      customerName: customerName || undefined,
      source: source || 'manual_admin_entry',
      interestScore: 100, // Explicitly added by owner
    });

    return NextResponse.json({ success: true, subscriber: saved });
  } catch (err: any) {
    console.error('[Admin WhatsApp API] Error creating subscriber:', err);
    return NextResponse.json({ error: 'Failed to save subscriber' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAdminAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Subscriber ID is required.' }, { status: 400 });
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
