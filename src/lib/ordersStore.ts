import { DbOrder } from '@/types/restaurant';
import {
  fetchAblyOrdersHistory,
  publishOrderAcknowledgedToAbly,
} from '@/lib/ably';

/**
 * Ephemeral Live Order Notification Store (100% Ably Pub/Sub & Channel History)
 * 
 * ZERO DATABASE STORAGE ARCHITECTURE:
 * Orders are transmitted via Ably real-time events. Pending orders waiting for
 * kitchen attention are retrieved and reconciled from Ably's 24-hour channel history.
 * Acknowledging an order emits an 'order_acknowledged' event to Ably, marking it handled
 * across all current and future admin dashboard views.
 * 
 * No database (Firebase, SQL, or MongoDB) is used for storing order records,
 * strictly maintaining zero database hosting and storage costs.
 */

const MAX_RECENT_ORDERS = 100;

interface GlobalOrdersStore {
  __spicy_garden_memory_orders__?: DbOrder[];
  __spicy_garden_acknowledged_ids__?: Set<string>;
}

const globalStore = globalThis as unknown as GlobalOrdersStore;
if (!globalStore.__spicy_garden_memory_orders__) {
  globalStore.__spicy_garden_memory_orders__ = [];
}
if (!globalStore.__spicy_garden_acknowledged_ids__) {
  globalStore.__spicy_garden_acknowledged_ids__ = new Set<string>();
}
let memoryOrders: DbOrder[] = globalStore.__spicy_garden_memory_orders__;
let acknowledgedIdsStore: Set<string> = globalStore.__spicy_garden_acknowledged_ids__;

export const TEST_USER_NAME = 'Test User';

export function isTestOrderRecord(o: any): boolean {
  if (!o) return true;
  const name = String(o.customer_name || '').trim().toLowerCase();
  if (name === '__system_healthcheck__' || name === '__automated_probe__') return true;
  if (o.is_test === true) return true;
  return false;
}

/**
 * Reconciles pending and acknowledged orders from Ably Channel History.
 */
export async function readOrdersFromStore(): Promise<DbOrder[]> {
  try {
    const historyMessages = await fetchAblyOrdersHistory(200);

    if (Array.isArray(historyMessages) && historyMessages.length > 0) {
      // 1. Collect all acknowledged order IDs from Ably history and globalStore
      const acknowledgedIds = new Set<string>(acknowledgedIdsStore);

      for (const msg of historyMessages) {
        if (msg.name === 'order_acknowledged' && msg.data) {
          const ackId = msg.data.orderId || msg.data.id;
          const ackNum = msg.data.orderNumber;
          if (ackId) {
            acknowledgedIds.add(String(ackId));
            acknowledgedIdsStore.add(String(ackId));
          }
          if (ackNum) {
            acknowledgedIds.add(String(ackNum));
            acknowledgedIdsStore.add(String(ackNum));
          }
        }
      }

      // Also include any locally acknowledged IDs from in-memory session
      for (const local of memoryOrders) {
        if (local.status === 'completed' || local.status === 'cancelled') {
          acknowledgedIds.add(String(local.id));
          acknowledgedIdsStore.add(String(local.id));
          if (local.order_number) {
            acknowledgedIds.add(String(local.order_number));
            acknowledgedIdsStore.add(String(local.order_number));
          }
        }
      }

      // 2. Extract unique 'new_order' records
      const ordersMap = new Map<string, DbOrder>();

      for (const msg of historyMessages) {
        if (msg.name === 'new_order' && msg.data) {
          let order: DbOrder = msg.data;
          if (typeof order === 'string') {
            try {
              order = JSON.parse(order);
            } catch {
              continue;
            }
          }

          if (!order || !order.id || isTestOrderRecord(order)) continue;

          const isAck =
            acknowledgedIds.has(String(order.id)) ||
            (order.order_number && acknowledgedIds.has(String(order.order_number)));

          const resolvedStatus = isAck ? 'completed' : (order.status || 'pending');

          if (!ordersMap.has(order.id)) {
            ordersMap.set(order.id, {
              ...order,
              status: resolvedStatus,
            });
          }
        }
      }

      // 3. Merge with local in-memory orders
      for (const local of memoryOrders) {
        if (!local || !local.id || isTestOrderRecord(local)) continue;
        const isAck =
          acknowledgedIds.has(String(local.id)) ||
          (local.order_number && acknowledgedIds.has(String(local.order_number)));
        const finalStatus = isAck ? 'completed' : local.status;

        if (ordersMap.has(local.id)) {
          const fromAbly = ordersMap.get(local.id)!;
          ordersMap.set(local.id, { ...fromAbly, status: finalStatus });
        } else {
          ordersMap.set(local.id, { ...local, status: finalStatus });
        }
      }

      const reconciled = Array.from(ordersMap.values());
      reconciled.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      memoryOrders = reconciled.slice(0, MAX_RECENT_ORDERS);
      globalStore.__spicy_garden_memory_orders__ = memoryOrders;
      return memoryOrders;
    }
  } catch (e) {
    console.warn('[ordersStore] Ably history read fallback to memory:', e);
  }

  return [...memoryOrders].filter((o) => !isTestOrderRecord(o));
}

export function readOrdersFromStoreSync(): DbOrder[] {
  return [...memoryOrders].filter((o) => !isTestOrderRecord(o));
}

export async function saveOrderToStore(order: DbOrder): Promise<DbOrder> {
  if (isTestOrderRecord(order)) return order;

  if (
    acknowledgedIdsStore.has(String(order.id)) ||
    (order.order_number && acknowledgedIdsStore.has(String(order.order_number)))
  ) {
    order.status = 'completed';
  }

  // Insert or update in-memory order strictly by unique order ID
  const existingIdx = memoryOrders.findIndex((o) => o.id === order.id);

  if (existingIdx >= 0) {
    memoryOrders[existingIdx] = { ...memoryOrders[existingIdx], ...order };
  } else {
    memoryOrders = [order, ...memoryOrders].slice(0, MAX_RECENT_ORDERS);
  }
  globalStore.__spicy_garden_memory_orders__ = memoryOrders;

  return order;
}

export async function acknowledgeOrderInStore(orderId: string): Promise<DbOrder | null> {
  acknowledgedIdsStore.add(String(orderId));

  let idx = memoryOrders.findIndex(
    (o) => o.id === orderId || (o.order_number && String(o.order_number) === String(orderId))
  );

  // If not found in local memory, fetch and reconcile from Ably history
  if (idx < 0) {
    await readOrdersFromStore();
    idx = memoryOrders.findIndex(
      (o) => o.id === orderId || (o.order_number && String(o.order_number) === String(orderId))
    );
  }

  let updatedOrder: DbOrder | null = null;
  const now = new Date().toISOString();

  if (idx >= 0) {
    if (memoryOrders[idx].order_number) {
      acknowledgedIdsStore.add(String(memoryOrders[idx].order_number));
    }
    updatedOrder = {
      ...memoryOrders[idx],
      status: 'completed',
      acknowledged_at: now,
      updated_at: now,
    };
    memoryOrders[idx] = updatedOrder;
    globalStore.__spicy_garden_memory_orders__ = memoryOrders;
  }

  // Publish acknowledgment to Ably so future queries reconcile it as handled
  try {
    const orderNum = updatedOrder?.order_number ? String(updatedOrder.order_number) : undefined;
    await publishOrderAcknowledgedToAbly(orderId, orderNum);
  } catch (err) {
    console.warn('[ordersStore] Failed to publish order acknowledgment to Ably:', err);
  }

  return updatedOrder;
}

export async function deleteOrderFromStore(identifier: string | number): Promise<boolean> {
  acknowledgedIdsStore.add(String(identifier));
  const initialLen = memoryOrders.length;
  memoryOrders = memoryOrders.filter(
    (o) => o.id !== identifier && o.order_number !== Number(identifier)
  );
  globalStore.__spicy_garden_memory_orders__ = memoryOrders;

  try {
    await publishOrderAcknowledgedToAbly(String(identifier));
  } catch {}

  return memoryOrders.length < initialLen;
}
