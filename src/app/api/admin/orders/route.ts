export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Owner-only order management (moved from /api/orders so every admin mutation
 * goes through the /api/admin middleware: auth + same-origin checks).
 *
 *   GET    /api/admin/orders[?status=pending]
 *   PATCH  /api/admin/orders   { orderId, action: 'acknowledge' | 'handled' }
 *   DELETE /api/admin/orders?id=<orderId>
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  readOrdersFromStore,
  acknowledgeOrderInStore,
  deleteOrderFromStore,
  isTestOrderRecord,
} from '@/lib/ordersStore';
import { publishOrderAcknowledgedToAbly } from '@/lib/ably';
import { jsonError, parseBody, requireAdmin } from '@/lib/apiGuard';
import { orderActionSchema, SAFE_ID } from '@/lib/schemas';

const STATUSES = new Set(['pending', 'confirmed', 'completed', 'cancelled']);

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const statusFilter = req.nextUrl.searchParams.get('status');
  if (statusFilter && !STATUSES.has(statusFilter)) return jsonError(400, 'Invalid status filter.');

  try {
    const allOrders = (await readOrdersFromStore()).filter((o) => !isTestOrderRecord(o));
    const orders = statusFilter ? allOrders.filter((o) => o.status === statusFilter) : allOrders;
    return NextResponse.json({ orders }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
  } catch (err) {
    console.error('[Admin Orders GET]', err);
    return jsonError(500, 'Failed to retrieve orders.');
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const parsed = await parseBody(req, orderActionSchema);
  if (!parsed.ok) return parsed.response;
  const { orderId } = parsed.data;

  try {
    const updated = await acknowledgeOrderInStore(orderId);
    publishOrderAcknowledgedToAbly(orderId, updated?.order_number ? String(updated.order_number) : undefined).catch(() => {});
    return NextResponse.json({ success: true, order: updated || { id: orderId, status: 'completed' } });
  } catch (err) {
    console.error('[Admin Orders PATCH]', err);
    return jsonError(500, 'Failed to update order.');
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const orderId = req.nextUrl.searchParams.get('id');
  if (!orderId || !SAFE_ID.test(orderId)) return jsonError(400, 'A valid order id is required.');

  try {
    await deleteOrderFromStore(orderId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Admin Orders DELETE]', err);
    return jsonError(500, 'Failed to delete order.');
  }
}
