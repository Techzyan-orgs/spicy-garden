'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAudioAlert } from '@/context/AudioAlertContext';
import {
  BellRing,
  UtensilsCrossed,
  Plus,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Phone,
  Check,
  MessageSquareShare,
} from 'lucide-react';

export default function AdminDashboardOverview() {
  const { recentOrders, acknowledgeOrder } = useAudioAlert();
  const [totalDishes, setTotalDishes] = useState(0);
  const [availableDishes, setAvailableDishes] = useState(0);
  const [totalSubscribers, setTotalSubscribers] = useState(0);
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [operations, setOperations] = useState<any>(null);
  const [liveStatus, setLiveStatus] = useState<any>(null);
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  useEffect(() => {
    const fetchMenuStats = async () => {
      try {
        const res = await fetch('/api/menu');
        if (res.ok) {
          const json = await res.json();
          const items = json.items || [];
          setTotalDishes(items.length);
          setAvailableDishes(items.filter((i: any) => i.isAvailable !== false).length);
        }
      } catch (e) {
      } finally {
        setIsLoadingMenu(false);
      }
    };

    const fetchSubscriberStats = async () => {
      try {
        const res = await fetch('/api/admin/whatsapp/subscribers');
        if (res.ok) {
          const json = await res.json();
          setTotalSubscribers(json.subscribers?.length || 0);
        }
      } catch (e) {}
    };

    const fetchOperations = async () => {
      try {
        const res = await fetch('/api/admin/operations');
        if (res.ok) {
          const json = await res.json();
          setOperations(json.operations);
          setLiveStatus(json.liveStatus);
        }
      } catch (e) {}
    };

    fetchMenuStats();
    fetchSubscriberStats();
    fetchOperations();
  }, []);

  const handleQuickStatusChange = async (newStatus: 'force_open' | 'force_closed' | 'auto') => {
    setIsSavingStatus(true);
    try {
      const res = await fetch('/api/admin/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualStatus: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setOperations(data.operations);
        setLiveStatus(data.liveStatus);
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          try {
            const channel = new BroadcastChannel('sg_operations_channel');
            channel.postMessage({ type: 'operations_updated', timestamp: Date.now() });
            channel.close();
          } catch (err) {}
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingStatus(false);
    }
  };

  const pendingCount = recentOrders.length;

  return (
    <div className="space-y-8">
      {/* Top Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Owner Dashboard
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Live orders &amp; menu control for The Spicy Garden Cafe &amp; Bistro
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/orders"
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-chili-600 hover:bg-chili-700 shadow-sm shadow-chili-600/30 transition-all active:scale-95"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>View Pending Orders ({pendingCount})</span>
          </Link>
          <Link
            href="/admin/operations"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-chili-600" />
            <span>Timings &amp; Status</span>
          </Link>
          <Link
            href="/admin/menu"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Dish</span>
          </Link>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Pending Orders Card */}
        <div className="p-5 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Active Pending Orders
            </span>
            <div className="flex items-baseline space-x-3">
              <span className="text-3xl font-extrabold text-gray-900 dark:text-white font-sans">
                {pendingCount}
              </span>
              {pendingCount > 0 ? (
                <span className="text-xs font-bold text-amber-600 bg-amber-100 dark:bg-amber-950 px-2.5 py-0.5 rounded-full animate-pulse">
                  Needs Attention
                </span>
              ) : (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full">
                  All Clear
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400">
              Orders placed by customers awaiting kitchen preparation.
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600">
            <BellRing className="w-6 h-6" />
          </div>
        </div>

        {/* Live Cafe Status Card */}
        <div className="p-5 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Cafe Live Status
              </span>
              <div className="flex items-center space-x-2">
                <span className={`w-2.5 h-2.5 rounded-full ${liveStatus?.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className="text-lg font-bold text-gray-900 dark:text-white font-sans">
                  {liveStatus?.statusText || 'Checking...'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                {liveStatus?.nextStatusText || 'IST Live Schedule'}
              </p>
            </div>
            <div className={`p-3 rounded-2xl ${liveStatus?.isOpen ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600'}`}>
              <Clock className="w-6 h-6" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={isSavingStatus || operations?.manualStatus === 'force_open'}
                onClick={() => handleQuickStatusChange('force_open')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  operations?.manualStatus === 'force_open'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-600'
                }`}
                title="Force Open Now"
              >
                Open
              </button>
              <button
                type="button"
                disabled={isSavingStatus || operations?.manualStatus === 'force_closed'}
                onClick={() => handleQuickStatusChange('force_closed')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  operations?.manualStatus === 'force_closed'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-rose-50 dark:hover:bg-rose-950 hover:text-rose-600'
                }`}
                title="Force Close Now"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isSavingStatus || operations?.manualStatus === 'auto'}
                onClick={() => handleQuickStatusChange('auto')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  operations?.manualStatus === 'auto'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-950 hover:text-blue-600'
                }`}
                title="Automatic Schedule"
              >
                Auto
              </button>
            </div>
            <Link
              href="/admin/operations"
              className="text-[11px] font-semibold text-chili-600 dark:text-chili-400 hover:underline flex items-center space-x-0.5"
            >
              <span>Edit</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Menu Items Card */}
        <div className="p-5 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Menu Catalog Dishes
            </span>
            <div className="flex items-baseline space-x-3">
              <span className="text-3xl font-extrabold text-gray-900 dark:text-white font-sans">
                {totalDishes}
              </span>
              <span className="text-xs font-semibold text-emerald-600">
                {availableDishes} available now
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              Controlled in real-time from the Menu Management portal.
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-chili-50 dark:bg-chili-950/60 text-chili-600">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
        </div>

        {/* WhatsApp Subscribers Card */}
        <div className="p-5 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              WhatsApp Subscribers
            </span>
            <div className="flex items-baseline space-x-3">
              <span className="text-3xl font-extrabold text-gray-900 dark:text-white font-sans">
                {totalSubscribers}
              </span>
              <Link
                href="/admin/marketing"
                className="text-xs font-semibold text-emerald-600 hover:underline flex items-center space-x-1"
              >
                <span>Launch Broadcast</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <p className="text-[11px] text-gray-400">
              Opted-in customer numbers encrypted with AES-256.
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
            <MessageSquareShare className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Pending Orders Queue Preview */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <BellRing className="w-5 h-5 text-chili-600" />
            <h3 className="font-serif text-lg font-bold text-gray-900 dark:text-white">
              Orders Awaiting Action
            </h3>
          </div>
          <Link
            href="/admin/orders"
            className="inline-flex items-center space-x-1 text-xs font-bold text-chili-600 hover:underline"
          >
            <span>Open Orders Desk</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              No pending orders.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Any new order placed on the website will instantly appear here and play a chime.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-2.5 rounded-l-xl">Order #</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Items</th>
                  <th className="px-4 py-2.5">Total</th>
                  <th className="px-4 py-2.5">Type / Address</th>
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5 rounded-r-xl text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {recentOrders.map((order) => {
                  const isCelebration = Boolean(
                    order.source &&
                      (order.source.toLowerCase().includes('celebration') ||
                        order.source.toLowerCase().includes('reservation'))
                  );
                  const itemCount = Array.isArray(order.items)
                    ? order.items.reduce((s: number, i: any) => s + (i.quantity || 1), 0)
                    : 1;

                  return (
                    <tr key={order.id} className="hover:bg-amber-50/50 dark:hover:bg-gray-800/70 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white font-mono">
                        #SG-{order.order_number}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800 dark:text-gray-200">
                          {order.customer_name}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {order.customer_phone}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {isCelebration ? (
                          <span className="inline-flex items-center space-x-1 text-purple-600 dark:text-purple-400 font-semibold">
                            <span>🎉 Reservation</span>
                          </span>
                        ) : (
                          `${itemCount} ${itemCount === 1 ? 'dish' : 'dishes'}`
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold font-sans text-gray-900 dark:text-white">
                        {isCelebration && order.total === 0 ? (
                          <span className="text-xs text-purple-600 dark:text-purple-400 font-bold">
                            Table Booking
                          </span>
                        ) : (
                          `₹${order.total}`
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-xs truncate text-[11px]">
                        {order.delivery_address || order.source || 'Takeaway'}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {order.created_at
                          ? new Date(order.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Just now'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => acknowledgeOrder(order.id)}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Handled</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
