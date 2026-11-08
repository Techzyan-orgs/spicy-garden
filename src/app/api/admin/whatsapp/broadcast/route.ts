import { NextRequest, NextResponse } from 'next/server';
import { verifyOwnerSessionToken, OWNER_SESSION_COOKIE } from '@/lib/auth';
import {
  getAllSubscribersDecrypted,
  updateCampaignDispatchStatus,
} from '@/lib/whatsappStore';
import {
  sendWhatsAppTextMessage,
  sendWhatsAppTemplateMessage,
  isWhatsAppConfigured,
  formatWhatsAppPhoneNumber,
} from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

async function checkAdminAuth(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(OWNER_SESSION_COOKIE)?.value;
  return await verifyOwnerSessionToken(token);
}

export async function POST(req: NextRequest) {
  if (!(await checkAdminAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      campaignTitle,
      messageText,
      target,
      testPhone,
      templateName,
      templateLanguage,
      templateComponents,
    } = body;

    if (!templateName && (!messageText || !messageText.trim())) {
      return NextResponse.json({ error: 'Message text or template name is required.' }, { status: 400 });
    }

    const campaign = (campaignTitle || templateName || 'General Promotional Broadcast').trim();

    // 1. Single Test Preview Dispatch
    if (target === 'test') {
      const cleanTest = (testPhone || '').replace(/\D/g, '').slice(-10);
      if (cleanTest.length < 10) {
        return NextResponse.json(
          { error: 'Valid 10-digit mobile number required for test preview.' },
          { status: 400 }
        );
      }

      if (!isWhatsAppConfigured()) {
        return NextResponse.json(
          {
            error:
              'WhatsApp Business API credentials (WHATSAPP_ACCESS_TOKEN & WHATSAPP_PHONE_NUMBER_ID) are not configured in environment variables.',
            isConfigured: false,
          },
          { status: 400 }
        );
      }

      const res = templateName
        ? await sendWhatsAppTemplateMessage(
            cleanTest,
            templateName,
            templateLanguage || 'en',
            templateComponents || []
          )
        : await sendWhatsAppTextMessage(cleanTest, (messageText || '').trim());

      if (!res.success) {
        return NextResponse.json(
          { error: res.error || 'Failed to dispatch test message via WhatsApp API.' },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Test preview successfully sent to +91 ${cleanTest}!`,
        messageId: res.messageId,
      });
    }

    // 2. Full Marketing Campaign Broadcast to All Opted-In Customers
    const subscribers = await getAllSubscribersDecrypted();
    if (subscribers.length === 0) {
      return NextResponse.json(
        { error: 'No opted-in WhatsApp subscribers found to broadcast to.' },
        { status: 400 }
      );
    }

    if (!isWhatsAppConfigured()) {
      return NextResponse.json(
        {
          error:
            'WhatsApp Business API is not configured. Please add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID to your environment variables.',
          isConfigured: false,
        },
        { status: 400 }
      );
    }

    let sentCount = 0;
    let failedCount = 0;
    const successfulIds: string[] = [];
    const dispatchErrors: { phone: string; error: string }[] = [];

    // Process in parallel batches of 5 to respect Meta API rate limits while staying under serverless timeouts
    const BATCH_SIZE = 5;
    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (sub) => {
          if (!sub.phone || sub.phone.length < 10) {
            failedCount++;
            return;
          }

          try {
            const sendResult = templateName
              ? await sendWhatsAppTemplateMessage(
                  sub.phone,
                  templateName,
                  templateLanguage || 'en',
                  templateComponents || []
                )
              : await sendWhatsAppTextMessage(sub.phone, (messageText || '').trim());

            if (sendResult.success) {
              sentCount++;
              successfulIds.push(sub.id);
            } else {
              failedCount++;
              dispatchErrors.push({ phone: sub.phone, error: sendResult.error || 'Failed' });
            }
          } catch (err: any) {
            failedCount++;
            dispatchErrors.push({ phone: sub.phone, error: err?.message || 'Dispatch exception' });
          }
        })
      );

      // Brief pause between batches
      if (i + BATCH_SIZE < subscribers.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Record campaign status on successfully notified subscribers
    if (successfulIds.length > 0) {
      await updateCampaignDispatchStatus(successfulIds, campaign, 'sent');
    }

    return NextResponse.json({
      success: true,
      totalSubscribers: subscribers.length,
      sentCount,
      failedCount,
      campaign,
      errors: dispatchErrors.slice(0, 5), // Return first 5 errors if any
    });
  } catch (err: any) {
    console.error('[Admin WhatsApp Broadcast API] Unexpected error:', err);
    return NextResponse.json(
      { error: err?.message || 'Broadcast campaign execution failed.' },
      { status: 500 }
    );
  }
}
