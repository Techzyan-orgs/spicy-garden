import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, parseBody, requireAdmin } from '@/lib/apiGuard';
import { storeErrorResponse } from '@/lib/apiErrors';
import { getAllSubscribersDecrypted, updateCampaignDispatchStatus } from '@/lib/whatsappStore';
import {
  sendWhatsAppTextMessage,
  sendWhatsAppTemplateMessage,
  isWhatsAppConfigured,
  templateBodyParams,
} from '@/lib/whatsapp';
import { INDIAN_MOBILE, normalizePhone } from '@/lib/schemas';
import { UNSUBSCRIBE_PATH } from '@/lib/consentText';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/whatsapp/broadcast
 *
 * Sends ONE batch (≤ 50 recipients) per request so a large list never runs
 * into the serverless time limit. The admin UI calls repeatedly with the
 * returned `nextCursor` until it is null.
 *
 * mode "template" (recommended): an approved Meta template; delivered to
 *   anyone who opted in.
 * mode "text": free text; WhatsApp only delivers it to customers who messaged
 *   you in the last 24 hours. An unsubscribe link is appended.
 */
const MAX_BATCH = 50;
const PARALLEL = 5;

const broadcastSchema = z
  .object({
    campaignTitle: z.string().trim().max(120).optional(),
    mode: z.enum(['template', 'text']).default('template'),
    messageText: z.string().trim().max(4000).optional(),
    templateName: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]{1,512}$/, 'template names use lowercase letters, digits and _')
      .optional(),
    templateLanguage: z
      .string()
      .trim()
      .regex(/^[a-z]{2,3}(_[A-Z]{2})?$/, 'e.g. en or en_US')
      .default('en'),
    templateParams: z.array(z.string().max(1000)).max(10).default([]),
    target: z.enum(['test', 'all']),
    testPhone: z.string().max(20).optional(),
    cursor: z.number().int().min(0).default(0),
    batchSize: z.number().int().min(1).max(MAX_BATCH).default(MAX_BATCH),
  })
  .refine((b) => (b.mode === 'template' ? Boolean(b.templateName) : Boolean(b.messageText)), {
    message: 'Provide an approved template name (template mode) or message text (text mode).',
  });

function maskPhone(phone: string | undefined): string {
  const p = String(phone ?? '');
  return p.length >= 4 ? `******${p.slice(-4)}` : '******';
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const parsed = await parseBody(req, broadcastSchema);
  if (!parsed.ok) return parsed.response;
  const b = parsed.data;

  if (!isWhatsAppConfigured()) {
    return jsonError(400, 'WhatsApp Business API is not configured (WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID).', {
      isConfigured: false,
    });
  }

  const origin = req.nextUrl.origin;
  const send = (phone: string) =>
    b.mode === 'template'
      ? sendWhatsAppTemplateMessage(
          phone,
          b.templateName!,
          b.templateLanguage,
          b.templateParams.length ? templateBodyParams(b.templateParams) : []
        )
      : sendWhatsAppTextMessage(phone, `${b.messageText}\n\nTo stop these messages: ${origin}${UNSUBSCRIBE_PATH}`);

  const campaign = (b.campaignTitle || b.templateName || 'WhatsApp broadcast').slice(0, 120);

  try {
    // 1. Single test message
    if (b.target === 'test') {
      const phone = normalizePhone(b.testPhone);
      if (!INDIAN_MOBILE.test(phone)) return jsonError(400, 'Valid 10-digit mobile number required for the test message.');
      const res = await send(phone);
      if (!res.success) {
        console.warn('[Admin WhatsApp Broadcast] Test send failed:', res.error);
        return jsonError(502, `WhatsApp did not accept the test message: ${String(res.error || 'unknown error').slice(0, 200)}`);
      }
      return NextResponse.json({ success: true, message: `Test message sent to ${maskPhone(phone)}.` });
    }

    // 2. One batch of the full list (stable order by subscriber id)
    const subscribers = await getAllSubscribersDecrypted();
    const total = subscribers.length;
    if (total === 0) return jsonError(400, 'No opted-in WhatsApp subscribers to broadcast to.');

    const batch = subscribers.slice(b.cursor, b.cursor + b.batchSize);
    const sentIds: string[] = [];
    const failedIds: string[] = [];
    const errors: { phone: string; error: string }[] = [];

    for (let i = 0; i < batch.length; i += PARALLEL) {
      await Promise.all(
        batch.slice(i, i + PARALLEL).map(async (sub) => {
          if (!INDIAN_MOBILE.test(sub.phone)) {
            failedIds.push(sub.id);
            errors.push({ phone: maskPhone(sub.phone), error: 'Invalid or undecryptable number' });
            return;
          }
          try {
            const res = await send(sub.phone);
            if (res.success) {
              sentIds.push(sub.id);
            } else {
              failedIds.push(sub.id);
              errors.push({ phone: maskPhone(sub.phone), error: 'Delivery failed' });
              console.warn('[Admin WhatsApp Broadcast] Send failed:', res.error);
            }
          } catch (err) {
            failedIds.push(sub.id);
            errors.push({ phone: maskPhone(sub.phone), error: 'Delivery failed' });
            console.warn('[Admin WhatsApp Broadcast] Send exception:', err instanceof Error ? err.message : err);
          }
        })
      );
    }

    await Promise.all([
      updateCampaignDispatchStatus(sentIds, campaign, 'sent'),
      updateCampaignDispatchStatus(failedIds, campaign, 'failed'),
    ]);

    const next = b.cursor + batch.length;
    return NextResponse.json({
      success: true,
      total,
      processed: next,
      sentCount: sentIds.length,
      failedCount: failedIds.length,
      nextCursor: next < total ? next : null,
      errors: errors.slice(0, 5),
      campaign,
    });
  } catch (err) {
    return storeErrorResponse(err, 'Admin WhatsApp Broadcast', 'Broadcast failed.');
  }
}
