import { DbOrder } from '@/types/restaurant';

export const ABLY_ORDERS_CHANNEL = process.env.ABLY_ORDERS_CHANNEL || 'order';

export async function generateAblyToken(): Promise<{ token: string; channel: string } | null> {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey || !apiKey.includes(':')) return null;

  try {
    const keyName = apiKey.split(':')[0];
    const authHeader = 'Basic ' + Buffer.from(apiKey).toString('base64');
    const res = await fetch(`https://rest.ably.io/keys/${keyName}/requestToken`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keyName,
        timestamp: Date.now(),
        ttl: 3600000, // 1 hour
        capability: JSON.stringify({
          [ABLY_ORDERS_CHANNEL]: ['subscribe'],
        }),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('[Ably Token] Failed to generate token:', errText);
      return null;
    }

    const data = await res.json();
    if (data?.token) {
      return { token: data.token, channel: ABLY_ORDERS_CHANNEL };
    }
    return null;
  } catch (err) {
    console.error('[Ably Token] Error requesting token:', err);
    return null;
  }
}

export async function publishOrderToAbly(order: DbOrder): Promise<boolean> {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) return false;

  try {
    const authHeader = 'Basic ' + Buffer.from(apiKey).toString('base64');
    const res = await fetch(`https://rest.ably.io/channels/${ABLY_ORDERS_CHANNEL}/messages`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'new_order',
        data: order,
      }),
    });

    return res.ok;
  } catch (err) {
    console.error('[Ably Publish] Error publishing new order:', err);
    return false;
  }
}

export async function publishOrderAcknowledgedToAbly(
  orderId: string,
  orderNumber?: string | number
): Promise<boolean> {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) return false;

  try {
    const authHeader = 'Basic ' + Buffer.from(apiKey).toString('base64');
    const res = await fetch(`https://rest.ably.io/channels/${ABLY_ORDERS_CHANNEL}/messages`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'order_acknowledged',
        data: {
          orderId: String(orderId),
          orderNumber: orderNumber ? String(orderNumber) : undefined,
          timestamp: new Date().toISOString(),
        },
      }),
    });

    return res.ok;
  } catch (err) {
    console.error('[Ably Publish] Error publishing order acknowledgment:', err);
    return false;
  }
}

export interface AblyHistoryMessage {
  id: string;
  name: string;
  data: any;
  timestamp: number;
}

/**
 * Retrieves order history messages from Ably with pagination support (up to 300 messages).
 * Prevents orders and acknowledgments from dropping off during busy shifts.
 */
export async function fetchAblyOrdersHistory(targetCount = 200): Promise<AblyHistoryMessage[]> {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) return [];

  const authHeader = 'Basic ' + Buffer.from(apiKey).toString('base64');
  let currentUrl: string | null = `https://rest.ably.io/channels/${encodeURIComponent(
    ABLY_ORDERS_CHANNEL
  )}/messages?limit=100&direction=backwards`;

  const allMessages: AblyHistoryMessage[] = [];
  let page = 0;
  const maxPages = Math.ceil(targetCount / 100);

  try {
    while (currentUrl && page < maxPages) {
      const res: Response = await fetch(currentUrl, {
        headers: {
          Authorization: authHeader,
        },
        cache: 'no-store',
      });

      if (!res.ok) {
        console.warn('[Ably History] Failed to fetch channel messages page:', res.status, res.statusText);
        break;
      }

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;

      for (const msg of data) {
        let content = msg.data;
        if (typeof content === 'string') {
          try {
            content = JSON.parse(content);
          } catch {}
        }
        allMessages.push({
          id: msg.id,
          name: msg.name,
          data: content,
          timestamp: msg.timestamp || Date.now(),
        });
      }

      // Read Ably pagination Link header (RFC 5988)
      const linkHeader: string | null = res.headers.get('link');
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match: RegExpMatchArray | null = linkHeader.match(/<([^>]+)>;\s*rel="next"/i);
        currentUrl = match ? match[1] : null;
      } else {
        currentUrl = null;
      }

      page++;
    }

    return allMessages;
  } catch (err) {
    console.error('[Ably History] Error fetching message history:', err);
    return allMessages;
  }
}
