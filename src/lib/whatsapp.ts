/**
 * Server-side WhatsApp Business Cloud API service abstraction.
 * Used for outbound automated transactional notifications (e.g. order confirmation, status updates).
 * Never exposes credentials to client-side code.
 */

interface WhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_PHONE_NUMBER_ID
  );
}

/**
 * Normalizes phone number to international E.164 without '+' or special characters.
 * Defaults to Indian country code (+91) if 10-digit mobile is provided.
 */
export function formatWhatsAppPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }
  return digits;
}

/**
 * Send a plain-text WhatsApp message via official Meta Graph API
 */
export async function sendWhatsAppTextMessage(
  recipientPhone: string,
  text: string
): Promise<WhatsAppResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    // Graceful fallback when API credentials are not yet configured
    return {
      success: false,
      error: 'WhatsApp Business API credentials are not configured in environment variables.',
    };
  }

  const formattedTo = formatWhatsAppPhoneNumber(recipientPhone);
  if (!formattedTo) {
    return { success: false, error: 'Invalid recipient phone number.' };
  }

  try {
    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedTo,
        type: 'text',
        text: {
          preview_url: false,
          body: text,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Log sanitized error message without leaking accessToken
      const safeError = data?.error?.message || `HTTP ${response.status} ${response.statusText}`;
      console.error('[WhatsApp Cloud API] Message dispatch failed:', safeError);
      return { success: false, error: safeError };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err: any) {
    console.error('[WhatsApp Cloud API] Network error dispatching message:', err?.message || err);
    return { success: false, error: err?.message || 'Network error communicating with WhatsApp API.' };
  }
}

/**
 * Send a pre-approved template message via Meta Graph API
 */
export async function sendWhatsAppTemplateMessage(
  recipientPhone: string,
  templateName: string,
  languageCode: string = 'en',
  components: any[] = []
): Promise<WhatsAppResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken || !phoneNumberId) {
    return {
      success: false,
      error: 'WhatsApp Business API credentials are not configured in environment variables.',
    };
  }

  const formattedTo = formatWhatsAppPhoneNumber(recipientPhone);
  if (!formattedTo) {
    return { success: false, error: 'Invalid recipient phone number.' };
  }

  try {
    const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formattedTo,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const safeError = data?.error?.message || `HTTP ${response.status}`;
      console.error('[WhatsApp Cloud API] Template dispatch failed:', safeError);
      return { success: false, error: safeError };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (err: any) {
    console.error('[WhatsApp Cloud API] Network error dispatching template:', err?.message || err);
    return { success: false, error: err?.message || 'Network error communicating with WhatsApp API.' };
  }
}
