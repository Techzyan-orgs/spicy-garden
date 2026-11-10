export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

/**
 * POST /api/orders — place an order or a celebration/table reservation.
 *
 * Public callers: validated body, distributed rate limit, café-open check,
 * server-side pricing from a fresh database read, cross-instance idempotency.
 * Authenticated owner (walk-in / POS orders): may set status & payment status,
 * bypasses the open-hours check and rate limit.
 *
 * Admin order listing / acknowledge / delete live at /api/admin/orders.
 */
import { NextRequest, NextResponse } from 'next/server';
import { DbOrder, OrderStatus, PaymentStatus, PaymentMode } from '@/types/restaurant';
import { readMenuFromStore } from '@/lib/menuStore';
import { readOrdersFromStore, saveOrderToStore } from '@/lib/ordersStore';
import { publishOrderToAbly } from '@/lib/ably';
import { sendWhatsAppTextMessage, isWhatsAppConfigured } from '@/lib/whatsapp';
import { addOrUpdateSubscriber } from '@/lib/whatsappStore';
import { isAdminRequest } from '@/lib/authServer';
import { readOperationsFromStore, calculateLiveOperationsStatus } from '@/lib/operationsStore';
import { storeErrorResponse } from '@/lib/apiErrors';
import { enforceRateLimit, getClientIp, jsonError, parseBody } from '@/lib/apiGuard';
import { createOrderSchema, INDIAN_MOBILE, normalizePhone } from '@/lib/schemas';
import { claimIdempotencyKey, completeIdempotencyKey, releaseIdempotencyKey } from '@/lib/idempotency';

const MAX_QTY_PER_DISH = 20;
const MAX_GUESTS = 100;
const WALK_IN_PHONE = '0000000000';

interface ValidatedItem {
  itemId: string;
  name: string;
  variant: 'veg' | 'non-veg' | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export async function POST(req: NextRequest) {
  const parsed = await parseBody(req, createOrderSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  let claimedKey: string | null = null;
  try {
    const isAdmin = await isAdminRequest(req);
    // Reservations are identified ONLY by an explicit orderType, never by free-text labels.
    const isReservation = body.orderType === 'reservation';

    // 1. Distributed rate limit for public callers (before any expensive work).
    if (!isAdmin) {
      const limited = await enforceRateLimit(
        'orders',
        getClientIp(req),
        'Too many order requests from your network. Please wait a few minutes before submitting another order.'
      );
      if (limited) return limited;
    }

    // 2. Field validation that depends on who is calling.
    const resolvedName = body.customerName || (isReservation ? '' : 'Guest Diner');
    if (resolvedName.length < 2) {
      return jsonError(400, 'Please enter your name (at least 2 characters).');
    }

    let phone = normalizePhone(body.customerPhone);
    if (isAdmin && (phone === '' || phone === WALK_IN_PHONE)) {
      phone = WALK_IN_PHONE; // walk-in order without a phone number
    } else if (!INDIAN_MOBILE.test(phone)) {
      return jsonError(400, 'A valid 10-digit Indian mobile number (starting with 6–9) is required.');
    }

    if (!isReservation && body.items.length === 0) {
      return jsonError(400, 'Order must contain at least one dish.');
    }
    if (!isAdmin && body.orderType === 'delivery' && !body.deliveryAddress) {
      return jsonError(400, 'A delivery address is required for home delivery.');
    }

    // 3. Café open check. Fails with 503 if hours cannot be read — we never guess "open".
    //    Advance reservations are accepted while the café is closed.
    const opsData = await readOperationsFromStore(true);
    const liveOps = calculateLiveOperationsStatus(opsData);
    if (!isAdmin && !liveOps.isOpen && !isReservation) {
      return jsonError(
        403,
        `The café is currently closed (${liveOps.statusText || 'Not accepting orders'}). Online orders are paused. Your items are saved in your cart and will be ready when we open!`,
        {
          isClosed: true,
          statusText: liveOps.statusText,
          nextStatusText: liveOps.nextStatusText,
          todayHoursDisplay: liveOps.todayHoursDisplay,
        }
      );
    }

    // 4. Idempotency across all serverless instances.
    if (body.idempotencyKey) {
      const claim = await claimIdempotencyKey(body.idempotencyKey);
      if (claim.status === 'done') return NextResponse.json(claim.response);
      if (claim.status === 'in_progress') {
        return jsonError(409, 'This order is already being processed. Please wait a moment.');
      }
      claimedKey = body.idempotencyKey;
    }

    // 5. Items: reservation placeholder, or server-side pricing from a fresh DB read.
    let computedSubtotal = 0;
    const validatedItems: ValidatedItem[] = [];

    if (isReservation) {
      const reservationTitle = (body.source || 'Celebration Booking').replace(/^Celebration:\s*/i, '');
      const guests = Math.min(MAX_GUESTS, body.items[0]?.quantity ?? 1);
      validatedItems.push({
        itemId: 'reservation',
        name: `Table Reservation: ${reservationTitle}`,
        variant: null,
        quantity: guests,
        unitPrice: 0,
        totalPrice: 0,
      });
    } else {
      const menuData = await readMenuFromStore(true);
      const itemMap = new Map(menuData.items.map((i) => [i.id, i]));

      for (const line of body.items) {
        const dbItem = itemMap.get(line.itemId);
        if (!dbItem) {
          return failAfterClaim(claimedKey, jsonError(400, `Item "${line.itemId}" was not found in the menu.`));
        }
        if (dbItem.is_available === false) {
          return failAfterClaim(claimedKey, jsonError(400, `Sorry, "${dbItem.name}" is currently sold out.`));
        }
        if (line.quantity > MAX_QTY_PER_DISH) {
          return failAfterClaim(
            claimedKey,
            jsonError(400, `At most ${MAX_QTY_PER_DISH} of "${dbItem.name}" per order. Please call us for large orders.`)
          );
        }

        const hasNonVegPrice = dbItem.chicken_price !== null && dbItem.chicken_price !== undefined;
        const variant = line.variant === 'non-veg' && hasNonVegPrice ? 'non-veg' : line.variant === 'veg' ? 'veg' : null;
        const unitPrice = Number(variant === 'non-veg' ? dbItem.chicken_price : dbItem.price);
        const lineTotal = unitPrice * line.quantity;
        computedSubtotal += lineTotal;

        validatedItems.push({
          itemId: dbItem.id,
          name: dbItem.name,
          variant,
          quantity: line.quantity,
          unitPrice,
          totalPrice: lineTotal,
        });
      }
    }

    // 6. Build the order record.
    const activeOrderNums = new Set((await readOrdersFromStore()).map((o) => o.order_number).filter(Boolean));
    let orderNumber = Math.floor(1000 + Math.random() * 9000);
    for (let attempts = 0; activeOrderNums.has(orderNumber) && attempts < 50; attempts++) {
      orderNumber = Math.floor(1000 + Math.random() * 9000);
    }
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const createdAt = new Date().toISOString();

    // Public clients can never mark anything as paid/confirmed — including reservations.
    const resolvedStatus: OrderStatus = isAdmin && body.status ? body.status : 'pending';
    const resolvedPaymentStatus: PaymentStatus = isAdmin && body.paymentStatus ? body.paymentStatus : 'unpaid';
    const resolvedPaymentMode: PaymentMode = body.paymentMode === 'upi' ? 'upi' : 'cash';

    const defaultSource =
      body.orderType === 'delivery' ? 'Home Delivery' : body.orderType === 'dine-in' ? 'Dine-In' : 'Takeaway';
    // The display label is trusted only from the owner or for reservations (where it carries the occasion).
    const source = (isAdmin || isReservation) && body.source ? body.source : isReservation ? 'Celebration Booking' : defaultSource;

    const orderRecord: DbOrder = {
      id: orderId,
      order_number: orderNumber,
      customer_name: resolvedName,
      customer_phone: phone,
      items: validatedItems,
      subtotal: computedSubtotal,
      total: computedSubtotal,
      status: resolvedStatus,
      payment_status: resolvedPaymentStatus,
      payment_mode: resolvedPaymentMode,
      upi_transaction_id: body.upiTransactionId ?? null,
      paid_at: resolvedPaymentStatus === 'paid' ? createdAt : null,
      source,
      notes: body.notes ?? null,
      delivery_address: body.orderType === 'delivery' ? body.deliveryAddress ?? null : null,
      delivery_coordinates: body.orderType === 'delivery' ? body.deliveryCoordinates ?? null : null,
      idempotency_key: body.idempotencyKey ?? null,
      created_at: createdAt,
      updated_at: createdAt,
    };

    await saveOrderToStore(orderRecord);

    // Store interested customer's WhatsApp contact (consent handling is reworked in Phase 5).
    if (phone !== WALK_IN_PHONE) {
      addOrUpdateSubscriber({
        phone,
        customerName: resolvedName,
        source: isReservation ? 'table_reservation' : 'online_order',
        interestScore: isReservation ? 90 : 100,
      }).catch((err) => {
        console.warn('[API Orders] Could not store customer WhatsApp contact:', err instanceof Error ? err.message : err);
      });
    }

    // Broadcast in real time via Ably for the kitchen chime.
    publishOrderToAbly(orderRecord).catch((err) => {
      console.warn('[API Orders] Ably publish notice:', err instanceof Error ? err.message : err);
    });

    // Optional WhatsApp confirmation
    if (isWhatsAppConfigured() && phone !== WALK_IN_PHONE) {
      sendWhatsAppTextMessage(phone, confirmationMessage(orderRecord, validatedItems, body.orderType, isReservation)).catch(() => {});
    }

    // Replay payload contains no customer PII (it is stored briefly in the database).
    const replayPayload = {
      success: true,
      orderId,
      orderNumber: `#SG-${orderNumber}`,
      subtotal: computedSubtotal,
      total: computedSubtotal,
      items: validatedItems,
    };
    if (claimedKey) {
      await completeIdempotencyKey(claimedKey, replayPayload).catch((err) => {
        console.warn('[API Orders] Could not record idempotency result:', err instanceof Error ? err.message : err);
      });
    }

    return NextResponse.json({ ...replayPayload, order: orderRecord }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (claimedKey) await releaseIdempotencyKey(claimedKey);
    return storeErrorResponse(error, 'API Orders POST', 'Failed to place order.');
  }
}

async function failAfterClaim(claimedKey: string | null, response: NextResponse): Promise<NextResponse> {
  if (claimedKey) await releaseIdempotencyKey(claimedKey);
  return response;
}

function confirmationMessage(
  order: DbOrder,
  items: ValidatedItem[],
  orderType: string | undefined,
  isReservation: boolean
): string {
  if (isReservation) {
    return `Hello ${order.customer_name}! Thank you for your celebration reservation request with The Spicy Garden - Cafe & Bistro.\n\nBooking Ref: #SG-${order.order_number}\n\n${order.notes || order.source}\n\nOur restaurant team has received your request and will call or message you to confirm!`;
  }
  const itemSummary = items
    .map((i) => `${i.quantity}x ${i.name} (${i.variant || 'Standard'}) - ₹${i.totalPrice}`)
    .join('\n');
  const serviceLine =
    orderType === 'delivery' && order.delivery_address
      ? `\n📍 Delivery To: ${order.delivery_address}`
      : orderType === 'dine-in'
      ? `\n🍽️ Service: Dine-In`
      : `\n🛍️ Service: Takeaway Pickup`;
  return `Hello ${order.customer_name}! Thank you for ordering from The Spicy Garden - Cafe & Bistro.\n\nOrder Ref: #SG-${order.order_number}\n\nItems:\n${itemSummary}\n\nTotal: ₹${order.total}${serviceLine}\n\nOur kitchen has received your order!`;
}
