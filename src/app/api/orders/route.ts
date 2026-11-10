export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { DbOrder, OrderStatus, PaymentStatus, PaymentMode } from '@/types/restaurant';
import { readMenuFromStore } from '@/lib/menuStore';
import {
  readOrdersFromStore,
  saveOrderToStore,
  acknowledgeOrderInStore,
  deleteOrderFromStore,
  isTestOrderRecord,
} from '@/lib/ordersStore';
import { publishOrderToAbly, publishOrderAcknowledgedToAbly } from '@/lib/ably';
import { sendWhatsAppTextMessage, isWhatsAppConfigured } from '@/lib/whatsapp';
import { addOrUpdateSubscriber } from '@/lib/whatsappStore';
import { isAdminRequest } from '@/lib/authServer';
import { readOperationsFromStore, calculateLiveOperationsStatus } from '@/lib/operationsStore';

interface OrderItemInput {
  itemId: string;
  variant?: 'veg' | 'non-veg';
  quantity: number;
}

interface OrderRequestBody {
  customerName?: string;
  customerPhone?: string;
  items: OrderItemInput[];
  notes?: string;
  deliveryAddress?: string;
  deliveryCoordinates?: { lat: number; lng: number };
  orderType?: 'delivery' | 'takeaway' | 'dine-in';
  idempotencyKey?: string;
  source?: string;
  paymentMode?: PaymentMode;
  upiTransactionId?: string;
}

// Bounded in-memory idempotency cache (auto-purged)
const recentSubmissions = new Map<string, { timestamp: number; response: any }>();

function cleanOldSubmissions() {
  const now = Date.now();
  recentSubmissions.forEach((val, key) => {
    if (now - val.timestamp > 120000) {
      recentSubmissions.delete(key);
    }
  });
}

const orderRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkOrderRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = orderRateLimits.get(ip);
  if (!record || now > record.resetAt) {
    orderRateLimits.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  record.count += 1;
  return record.count <= 15;
}

const checkAdminAuth = isAdminRequest;

export async function GET(req: NextRequest) {
  // Only authenticated owner/staff can read order list & customer PII
  if (!(await checkAdminAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized: Owner session required.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');

    const allOrders = (await readOrdersFromStore()).filter((o) => !isTestOrderRecord(o));
    const filtered = statusFilter
      ? allOrders.filter((o) => o.status === statusFilter)
      : allOrders;

    return NextResponse.json(
      { orders: filtered },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to retrieve orders' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: OrderRequestBody = await req.json();
    const {
      customerName,
      customerPhone,
      items,
      notes,
      deliveryAddress,
      deliveryCoordinates,
      orderType,
      idempotencyKey,
      source,
      paymentMode,
      upiTransactionId,
    } = body;

    const isReservation = Boolean(
      source &&
        (source.toLowerCase().includes('celebration') ||
          source.toLowerCase().includes('reservation') ||
          source.toLowerCase().includes('table'))
    );

    // 0. Cafe Open Status Validation (Guaranteed in production)
    // Advance reservations and celebration requests are accepted for future dates even when the café is currently closed
    const isAdmin = await checkAdminAuth(req);
    const opsData = await readOperationsFromStore();
    const liveOps = calculateLiveOperationsStatus(opsData);

    if (!isAdmin && !liveOps.isOpen && !isReservation) {
      return NextResponse.json(
        {
          error: `The café is currently closed (${liveOps.statusText || 'Not accepting orders'}). Online orders are paused. Your items are saved in your cart and will be ready when we open!`,
          isClosed: true,
          statusText: liveOps.statusText,
          nextStatusText: liveOps.nextStatusText,
          todayHoursDisplay: liveOps.todayHoursDisplay,
        },
        { status: 403 }
      );
    }

    const clientIp =
      req.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('cf-connecting-ip')?.trim() ||
      req.headers.get('x-real-ip')?.trim() ||
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      '127.0.0.1';
    if (!isAdmin && !checkOrderRateLimit(clientIp)) {
      return NextResponse.json(
        { error: 'Too many order requests from your network. Please wait a few minutes before submitting another order.' },
        { status: 429 }
      );
    }

    // 1. Validation
    const resolvedName = customerName?.trim() || 'Guest Diner';
    if (resolvedName.length < 2) {
      return NextResponse.json(
        { error: 'Customer name must be at least 2 characters.' },
        { status: 400 }
      );
    }

    const cleanPhone = customerPhone?.replace(/\D/g, '') || '';
    if (cleanPhone.length < 10) {
      return NextResponse.json(
        { error: 'A valid 10-digit mobile phone number is required.' },
        { status: 400 }
      );
    }

    if (!isReservation && (!items || !Array.isArray(items) || items.length === 0)) {
      return NextResponse.json(
        { error: 'Order must contain at least one dish.' },
        { status: 400 }
      );
    }

    // 2. Idempotency Check
    cleanOldSubmissions();
    if (idempotencyKey) {
      const existing = recentSubmissions.get(idempotencyKey);
      if (existing && Date.now() - existing.timestamp < 60000) {
        return NextResponse.json(existing.response);
      }
    }

    // 3. Server-side price calculation / reservation item synthesis
    let computedSubtotal = 0;
    const validatedItems: Array<{
      itemId: string;
      name: string;
      variant?: 'veg' | 'non-veg' | null;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }> = [];

    if (isReservation && (!items || items.length === 0 || items.some((i) => i.itemId === 'reservation'))) {
      const reservationTitle = source ? source.replace(/^Celebration:\s*/i, '') : 'Celebration Booking';
      const guestQty = Math.max(1, Math.min(100, Math.floor(items?.[0]?.quantity || 1)));
      validatedItems.push({
        itemId: 'reservation',
        name: `Table Reservation: ${reservationTitle}`,
        variant: null,
        quantity: guestQty,
        unitPrice: 0,
        totalPrice: 0,
      });
      computedSubtotal = 0;
    } else {
      const menuData = await readMenuFromStore();
      const itemMap = new Map(menuData.items.map((i) => [i.id, i]));

      for (const itemInput of items) {
        const dbItem = itemMap.get(itemInput.itemId);
        if (!dbItem) {
          return NextResponse.json(
            { error: `Item "${itemInput.itemId}" was not found in the menu.` },
            { status: 400 }
          );
        }

        if (dbItem.is_available === false) {
          return NextResponse.json(
            { error: `Sorry, "${dbItem.name}" is currently sold out.` },
            { status: 400 }
          );
        }

        const qty = Math.max(1, Math.min(20, Math.floor(itemInput.quantity || 1)));
        let unitPrice = Number(dbItem.price);
        if (itemInput.variant === 'non-veg' && dbItem.chicken_price) {
          unitPrice = Number(dbItem.chicken_price);
        }

        const lineTotal = unitPrice * qty;
        computedSubtotal += lineTotal;

        validatedItems.push({
          itemId: dbItem.id,
          name: dbItem.name,
          variant: itemInput.variant || null,
          quantity: qty,
          unitPrice,
          totalPrice: lineTotal,
        });
      }
    }

    const activeOrderNums = new Set((await readOrdersFromStore()).map((o) => o.order_number).filter(Boolean));
    let orderNumber = Math.floor(1000 + Math.random() * 9000);
    let attempts = 0;
    while (activeOrderNums.has(orderNumber) && attempts < 50) {
      orderNumber = Math.floor(1000 + Math.random() * 9000);
      attempts++;
    }
    const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const createdAt = new Date().toISOString();

    // Enforce server-side payment security:
    // Public web clients cannot forge "paid" status. Authenticated admin staff walk-in orders carry verified admin cookie.
    const resolvedStatus: OrderStatus =
      isAdmin && (body as any).status && ['pending', 'confirmed', 'completed', 'cancelled'].includes((body as any).status)
        ? (body as any).status
        : 'pending';

    const resolvedPaymentStatus: PaymentStatus =
      isAdmin && (body as any).paymentStatus && ['paid', 'unpaid'].includes((body as any).paymentStatus)
        ? (body as any).paymentStatus
        : isReservation
        ? 'paid'
        : 'unpaid';

    const resolvedPaymentMode: PaymentMode = paymentMode === 'upi' ? 'upi' : 'cash';

    const orderRecord: DbOrder = {
      id: orderId,
      order_number: orderNumber,
      customer_name: resolvedName,
      customer_phone: cleanPhone,
      items: validatedItems,
      subtotal: computedSubtotal,
      total: computedSubtotal,
      status: resolvedStatus,
      payment_status: resolvedPaymentStatus,
      payment_mode: resolvedPaymentMode,
      upi_transaction_id: upiTransactionId?.trim() || null,
      paid_at: resolvedPaymentStatus === 'paid' ? createdAt : null,
      source: source || (orderType === 'delivery' ? 'Home Delivery' : orderType === 'dine-in' ? 'Dine-In' : 'Takeaway'),
      notes: notes?.trim() || null,
      delivery_address: deliveryAddress?.trim() || null,
      delivery_coordinates: deliveryCoordinates || null,
      idempotency_key: idempotencyKey || null,
      created_at: createdAt,
      updated_at: createdAt,
    };

    // Save to ephemeral session store for active admin view
    await saveOrderToStore(orderRecord);

    // Store interested customer's WhatsApp contact number in Firebase Realtime Database
    if (cleanPhone && cleanPhone.length === 10 && cleanPhone !== '0000000000') {
      addOrUpdateSubscriber({
        phone: cleanPhone,
        customerName: resolvedName,
        source: isReservation ? 'table_reservation' : 'online_order',
        interestScore: isReservation ? 90 : 100,
      }).catch((err) => {
        console.warn('[API Orders] Could not store customer WhatsApp contact to Firebase:', err);
      });
    }

    // Broadcast in real-time via Ably Pub/Sub for immediate kitchen audio chime
    publishOrderToAbly(orderRecord).catch((err) => {
      console.warn('[API Orders] Ably publish notice:', err);
    });

    // Optional WhatsApp confirmation
    if (isWhatsAppConfigured() && cleanPhone !== '0000000000') {
      if (isReservation) {
        const message = `Hello ${resolvedName}! Thank you for your celebration reservation request with The Spicy Garden - Cafe & Bistro.\n\nBooking Ref: #SG-${orderNumber}\n\n${orderRecord.notes || orderRecord.source}\n\nOur restaurant team has received your request and will call or message you to confirm!`;
        sendWhatsAppTextMessage(cleanPhone, message).catch(() => {});
      } else {
        const itemSummary = validatedItems
          .map((i) => `${i.quantity}x ${i.name} (${i.variant || 'Standard'}) - ₹${i.totalPrice}`)
          .join('\n');
        const serviceLine =
          orderType === 'delivery' && deliveryAddress
            ? `\n📍 Delivery To: ${deliveryAddress}`
            : orderType === 'dine-in'
            ? `\n🍽️ Service: Dine-In`
            : `\n🛍️ Service: Takeaway Pickup`;
        const message = `Hello ${resolvedName}! Thank you for ordering from The Spicy Garden - Cafe & Bistro.\n\nOrder Ref: #SG-${orderNumber}\n\nItems:\n${itemSummary}\n\nTotal: ₹${computedSubtotal}${serviceLine}\n\nOur kitchen has received your order!`;
        sendWhatsAppTextMessage(cleanPhone, message).catch(() => {});
      }
    }

    const responsePayload = {
      success: true,
      orderId,
      orderNumber: `#SG-${orderNumber}`,
      order: orderRecord,
      subtotal: computedSubtotal,
      total: computedSubtotal,
      items: validatedItems,
    };

    if (idempotencyKey) {
      recentSubmissions.set(idempotencyKey, {
        timestamp: Date.now(),
        response: responsePayload,
      });
    }

    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error('[API Orders POST] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to place order.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await checkAdminAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized: Owner session required.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { orderId, action } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required.' }, { status: 400 });
    }

    if (action === 'acknowledge' || action === 'handled') {
      const updated = await acknowledgeOrderInStore(orderId);
      publishOrderAcknowledgedToAbly(orderId, updated?.order_number ? String(updated.order_number) : undefined).catch(() => {});
      return NextResponse.json({
        success: true,
        order: updated || { id: orderId, status: 'completed' },
      });
    }

    return NextResponse.json({ error: 'Order not found in active session.' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update order' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await checkAdminAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized: Owner session required.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('id');
    if (!orderId) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await deleteOrderFromStore(orderId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 });
  }
}
