'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { playOrderChime, getAudioContext, unlockAudio, isAudioContextRunning } from '@/lib/audio';

export interface GlobalOrderNotification {
  id: string;
  order_number: string | number;
  customer_name: string;
  customer_phone: string;
  items?: any[];
  total: number;
  notes?: string;
  created_at: string;
  status?: string;
  delivery_address?: string | null;
  source?: string;
}

interface AudioAlertContextType {
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  triggerChime: () => Promise<boolean>;
  toggleSound: () => void;
  isAudioUnlocked: boolean;
  unlockAudioManually: () => Promise<boolean>;
  activeOrderAlert: GlobalOrderNotification | null;
  recentOrders: GlobalOrderNotification[];
  dismissOrderAlert: () => void;
  requestDesktopPermission: () => Promise<void>;
  acknowledgeOrder: (orderId: string) => Promise<void>;
}

const AudioAlertContext = createContext<AudioAlertContextType>({
  soundEnabled: true,
  setSoundEnabled: () => {},
  triggerChime: async () => false,
  toggleSound: () => {},
  isAudioUnlocked: false,
  unlockAudioManually: async () => false,
  activeOrderAlert: null,
  recentOrders: [],
  dismissOrderAlert: () => {},
  requestDesktopPermission: async () => {},
  acknowledgeOrder: async () => {},
});

export const useAudioAlert = () => useContext(AudioAlertContext);

function getHandledOrderIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem('sg_handled_order_ids');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.map(String));
      }
    }
  } catch {}
  return new Set();
}

function recordOrderHandled(orderId: string, orderNumber?: string | number) {
  if (typeof window === 'undefined') return;
  try {
    // 1. Add to handled IDs set in localStorage
    const handled = getHandledOrderIds();
    if (orderId) handled.add(String(orderId));
    if (orderNumber) handled.add(String(orderNumber));
    // Only order IDs/numbers are stored — never customer details.
    localStorage.setItem('sg_handled_order_ids', JSON.stringify(Array.from(handled).slice(-500)));
  } catch {}
}

export function AudioAlertProvider({ children }: { children: React.ReactNode }) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [activeOrderAlert, setActiveOrderAlert] = useState<GlobalOrderNotification | null>(null);
  const [recentOrders, setRecentOrders] = useState<GlobalOrderNotification[]>([]);
  const recentAlertIds = useRef<Set<string>>(new Set());
  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const initialHydratedRef = useRef<boolean>(false);
  // Live Ably stream health drives the safety-net poll rate (see effect #2).
  const streamConnectedRef = useRef<boolean>(false);
  const pollNowRef = useRef<() => void>(() => {});
  const pollSoonRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sg_admin_sound_enabled');
      setSoundEnabled(saved !== 'false');
      if (isAudioContextRunning()) {
        setIsAudioUnlocked(true);
      }
    }

    // Actively unlock audio context on any user interaction across the entire document
    const handleUserInteraction = () => {
      unlockAudio().then((unlocked) => {
        if (unlocked) {
          setIsAudioUnlocked(true);
        }
      });
    };

    window.addEventListener('click', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('pointerdown', handleUserInteraction, { passive: true });

    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('pointerdown', handleUserInteraction);
    };
  }, []);

  const unlockAudioManually = useCallback(async (): Promise<boolean> => {
    setSoundEnabled(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sg_admin_sound_enabled', 'true');
    }
    const unlocked = await unlockAudio();
    setIsAudioUnlocked(true);
    await playOrderChime();
    return unlocked;
  }, []);

  const toggleSound = useCallback(async () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sg_admin_sound_enabled', nextState.toString());
    }
    if (nextState) {
      await unlockAudio();
      setIsAudioUnlocked(true);
      await playOrderChime();
    }
  }, [soundEnabled]);

  const triggerChime = useCallback(async (): Promise<boolean> => {
    if (soundEnabled) {
      return await playOrderChime();
    }
    return false;
  }, [soundEnabled]);

  const dismissOrderAlert = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
    }
    setActiveOrderAlert(null);
  }, []);

  const requestDesktopPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }
  };

  const handleIncomingOrder = useCallback(
    (rawOrder: any) => {
      if (!rawOrder) return;

      // Handle raw stringified JSON payloads from Ably SSE messages
      let order: GlobalOrderNotification = rawOrder;
      if (typeof order === 'string') {
        try {
          order = JSON.parse(order);
        } catch {
          return;
        }
      }

      if (!order || !order.id) return;

      // Verify that this order has not already been handled
      const handledIds = getHandledOrderIds();
      if (
        handledIds.has(String(order.id)) ||
        (order.order_number && handledIds.has(String(order.order_number))) ||
        order.status === 'completed' ||
        order.status === 'cancelled'
      ) {
        return;
      }

      // Prevent redundant notifications within 60s
      if (recentAlertIds.current.has(order.id)) {
        return;
      }
      recentAlertIds.current.add(order.id);
      setTimeout(() => {
        recentAlertIds.current.delete(order.id);
      }, 60000);

      triggerChime();
      setActiveOrderAlert(order);

      setRecentOrders((prev) => [
        order,
        ...prev.filter(
          (o) =>
            o.id !== order.id &&
            (!order.order_number || String(o.order_number) !== String(order.order_number))
        ),
      ]);

      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
      dismissTimerRef.current = setTimeout(() => {
        setActiveOrderAlert(null);
      }, 25000);

      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        try {
          const isCelebration = Boolean(
            order.source &&
              (order.source.toLowerCase().includes('celebration') ||
                order.source.toLowerCase().includes('reservation'))
          );
          const notif = new Notification(
            isCelebration
              ? `🎉 New Celebration Booking #SG-${order.order_number || 'Live'}`
              : `🔔 New Order #SG-${order.order_number || 'Live'}`,
            {
              body: isCelebration
                ? `${order.customer_name} booked: ${order.source}`
                : `${order.customer_name} placed an order for ₹${order.total}`,
              icon: '/icons/icon-192x192.png',
              tag: order.id,
            }
          );
          notif.onclick = () => {
            window.focus();
            window.location.href = '/admin/orders';
          };
        } catch (e) {}
      }
    },
    [triggerChime]
  );

  const acknowledgeOrder = useCallback(
    async (orderId: string) => {
      try {
        const target = recentOrders.find((o) => o.id === orderId);
        recordOrderHandled(orderId, target?.order_number);

        setRecentOrders((prev) => prev.filter((o) => o.id !== orderId));
        if (activeOrderAlert?.id === orderId) {
          setActiveOrderAlert(null);
        }

        await fetch('/api/admin/orders', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, action: 'acknowledge' }),
        });
      } catch (e) {
        console.error('[AudioAlertContext] Error acknowledging order:', e);
      }
    },
    [activeOrderAlert, recentOrders]
  );

  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';

  // 1. Setup Ably Realtime listener directly to Ably Cloud with automated token rotation
  useEffect(() => {
    if (isLoginPage) return;
    let es: EventSource | null = null;
    let isCancelled = false;
    let refreshTimer: NodeJS.Timeout | null = null;
    let retryTimer: NodeJS.Timeout | null = null;

    // Connected -> poll once now (catch anything missed while down), then slow down.
    // Disconnected -> make sure the next safety-net poll happens within the fast interval.
    const setStreamConnected = (connected: boolean) => {
      const was = streamConnectedRef.current;
      streamConnectedRef.current = connected;
      if (connected && !was) pollNowRef.current();
      else if (!connected && was) pollSoonRef.current();
    };

    // The stream replays recent history on every (re)connect (rewind). Only alert for
    // orders this tab has not already seen, so pending orders don't chime again after
    // each reconnect / 50-minute token rotation, while orders missed during the gap still do.
    const handleStreamOrder = (payload: any) => {
      const id = payload && typeof payload === 'object' ? payload.id : undefined;
      if (id) {
        const known = knownOrderIdsRef.current;
        const num = payload.order_number;
        if (known.has(String(id)) || (num && known.has(String(num)))) return;
        known.add(String(id));
        if (num) known.add(String(num));
      }
      handleIncomingOrder(payload);
    };

    const cleanup = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      if (retryTimer) clearTimeout(retryTimer);
      if (es) {
        es.close();
        es = null;
        setStreamConnected(false);
      }
    };

    const connectStream = async () => {
      cleanup();
      if (isCancelled) return;

      try {
        const tokenRes = await fetch('/api/ably/token', { cache: 'no-store' });
        if (!tokenRes.ok) {
          // Retry token acquisition in 10s if momentarily unauthorized or offline
          if (!isCancelled) {
            retryTimer = setTimeout(connectStream, 10000);
          }
          return;
        }

        const authData = await tokenRes.json();
        if (!authData?.token || !authData?.channel || isCancelled) {
          if (!isCancelled) {
            retryTimer = setTimeout(connectStream, 10000);
          }
          return;
        }

        // Connect directly to Ably Cloud SSE (bypassing Vercel Serverless Function timeout limits)
        const streamUrl = `https://realtime.ably.io/event-stream?channels=${encodeURIComponent(
          authData.channel
        )}&v=1.2&token=${encodeURIComponent(authData.token)}&rewind=50`;

        es = new EventSource(streamUrl);

        es.onopen = () => setStreamConnected(true);

        es.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            const messages = Array.isArray(parsed) ? parsed : [parsed];

            for (const msg of messages) {
              if (msg.name === 'new_order' && msg.data) {
                let orderPayload = msg.data;
                if (typeof orderPayload === 'string') {
                  try {
                    orderPayload = JSON.parse(orderPayload);
                  } catch {}
                }
                handleStreamOrder(orderPayload);
              } else if (msg.name === 'order_acknowledged' && msg.data) {
                let ackPayload = msg.data;
                if (typeof ackPayload === 'string') {
                  try {
                    ackPayload = JSON.parse(ackPayload);
                  } catch {}
                }
                const targetId = ackPayload?.orderId || ackPayload?.id;
                const targetNum = ackPayload?.orderNumber;
                if (targetId) {
                  recordOrderHandled(String(targetId), targetNum);
                  setRecentOrders((prev) =>
                    prev.filter(
                      (o) =>
                        String(o.id) !== String(targetId) &&
                        (!targetNum || String(o.order_number) !== String(targetNum))
                    )
                  );
                }
              }
            }
          } catch (e) {}
        };

        es.onerror = () => {
          // Token expired or connection dropped: close stream and smoothly refresh with a fresh token
          cleanup();
          if (!isCancelled) {
            retryTimer = setTimeout(connectStream, 5000);
          }
        };

        // Proactive token rotation every 50 minutes (tokens have 60-min TTL) for 24/7 uninterrupted uptime
        refreshTimer = setTimeout(() => {
          if (!isCancelled) {
            connectStream();
          }
        }, 50 * 60 * 1000);
      } catch (err) {
        if (!isCancelled) {
          retryTimer = setTimeout(connectStream, 10000);
        }
      }
    };

    connectStream();

    return () => {
      isCancelled = true;
      cleanup();
    };
  }, [handleIncomingOrder, isLoginPage]);

  // 2. Active Pending Orders Polling & Local Cache Hydration
  useEffect(() => {
    if (isLoginPage) return;

    // Full orders (names, phones, addresses) are never kept in browser storage; the
    // pending list always comes from the server. Purge caches left by older builds.
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('sg_orders_cache');
        localStorage.removeItem('sg_last_order_event');
      } catch {}
    }

    const fetchPendingOrders = async () => {
      try {
        const res = await fetch('/api/admin/orders?status=pending', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          const serverPending: GlobalOrderNotification[] = json.orders || [];
          const handledIds = getHandledOrderIds();

          // Authoritative list from server, excluding any marked handled locally
          const activeServerPending = serverPending.filter((o) => {
            if (!o || !o.id) return false;
            if (handledIds.has(String(o.id))) return false;
            if (o.order_number && handledIds.has(String(o.order_number))) return false;
            return true;
          });

          // If already hydrated, trigger chime and alerts for any newly discovered orders from the server
          if (initialHydratedRef.current) {
            for (const order of activeServerPending) {
              if (order?.id && !knownOrderIdsRef.current.has(String(order.id))) {
                knownOrderIdsRef.current.add(String(order.id));
                if (order.order_number) knownOrderIdsRef.current.add(String(order.order_number));
                handleIncomingOrder(order);
              }
            }
          } else {
            // Seed known orders on initial load so we don't spam chimes for old orders already present
            activeServerPending.forEach((o) => {
              if (o?.id) knownOrderIdsRef.current.add(String(o.id));
              if (o?.order_number) knownOrderIdsRef.current.add(String(o.order_number));
            });
            initialHydratedRef.current = true;
          }

          // Always ensure active orders are marked as known
          activeServerPending.forEach((o) => {
            if (o?.id) knownOrderIdsRef.current.add(String(o.id));
          });

          setRecentOrders((prev) => {
            const map = new Map<string, GlobalOrderNotification>();
            activeServerPending.forEach((o) => {
              if (o && o.id) map.set(o.id, o);
            });

            // Retain recent in-flight real-time orders (created < 20s ago) that haven't been completed yet
            // NEVER resurrect old orders that the server omitted (as the server determined they are handled)
            const now = Date.now();
            prev.forEach((o) => {
              if (!o || !o.id) return;
              if (handledIds.has(String(o.id))) return;
              if (o.order_number && handledIds.has(String(o.order_number))) return;

              const ageMs = o.created_at ? now - new Date(o.created_at).getTime() : Infinity;
              if (ageMs < 20000 && !map.has(o.id)) {
                map.set(o.id, o);
              }
            });

            return Array.from(map.values());
          });
        }
      } catch (e) {}
    };

    // Adaptive safety-net poll: the live Ably stream delivers new orders instantly, so while
    // it is connected we only reconcile every 60s; while it is down we poll every 10s.
    const FAST_POLL_MS = 10_000;
    const SLOW_POLL_MS = 60_000;
    const MIN_GAP_MS = 3_000; // collapse bursts of "poll now" triggers
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let inFlight = false;
    let nextAt = 0;
    let lastRunAt = 0;

    const schedule = (delay: number) => {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      nextAt = Date.now() + delay;
      timer = setTimeout(run, delay);
    };

    async function run() {
      if (stopped || inFlight) return;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      inFlight = true;
      lastRunAt = Date.now();
      try {
        await fetchPendingOrders();
      } finally {
        inFlight = false;
        schedule(streamConnectedRef.current ? SLOW_POLL_MS : FAST_POLL_MS);
      }
    }

    const pollNow = () => {
      if (Date.now() - lastRunAt < MIN_GAP_MS) return;
      void run();
    };

    pollNowRef.current = pollNow;
    pollSoonRef.current = () => {
      if (!inFlight && nextAt - Date.now() > FAST_POLL_MS) schedule(FAST_POLL_MS);
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') pollNow();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', pollNow);

    void run();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      pollNowRef.current = () => {};
      pollSoonRef.current = () => {};
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', pollNow);
    };
  }, [isLoginPage]);

  // 3. Same-Browser Cross-Tab / Window Listeners (BroadcastChannel + storage + CustomEvent)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let bc: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('sg_orders_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'NEW_ORDER' && event.data?.order) {
            handleIncomingOrder(event.data.order);
          }
        };
      } catch (e) {}
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'sg_last_order_event' && e.newValue) {
        try {
          const order = JSON.parse(e.newValue);
          if (order && order.id) {
            handleIncomingOrder(order);
          }
        } catch {}
      } else if (e.key === 'sg_handled_order_ids' && e.newValue) {
        try {
          const handledArr = JSON.parse(e.newValue);
          if (Array.isArray(handledArr)) {
            const set = new Set(handledArr.map(String));
            setRecentOrders((prev) =>
              prev.filter(
                (o) =>
                  !set.has(String(o.id)) &&
                  (!o.order_number || !set.has(String(o.order_number)))
              )
            );
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    const handleCustom = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail && ce.detail.id) {
        handleIncomingOrder(ce.detail);
      }
    };
    window.addEventListener('sg_new_order', handleCustom);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('sg_new_order', handleCustom);
    };
  }, [handleIncomingOrder]);

  return (
    <AudioAlertContext.Provider
      value={{
        soundEnabled,
        setSoundEnabled,
        triggerChime,
        toggleSound,
        isAudioUnlocked,
        unlockAudioManually,
        activeOrderAlert,
        recentOrders,
        dismissOrderAlert,
        requestDesktopPermission,
        acknowledgeOrder,
      }}
    >
      {children}
    </AudioAlertContext.Provider>
  );
}
