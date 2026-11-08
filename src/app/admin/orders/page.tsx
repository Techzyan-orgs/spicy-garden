'use client';

import React, { useState, useEffect } from 'react';
import { useAudioAlert } from '@/context/AudioAlertContext';
import {
  BellRing,
  Clock,
  CheckCircle2,
  Phone,
  MessageCircle,
  Volume2,
  VolumeX,
  Search,
  Check,
  MapPin,
  UtensilsCrossed,
  Sparkles,
  ShoppingBag,
  Utensils,
  Coffee,
  Plus,
  Calendar,
  PartyPopper,
} from 'lucide-react';
import ManualOrderModal from '@/components/ManualOrderModal';

export default function AdminPendingOrdersPage() {
  const {
    soundEnabled,
    toggleSound,
    triggerChime,
    isAudioUnlocked,
    unlockAudioManually,
    recentOrders,
    acknowledgeOrder,
  } = useAudioAlert();

  const [searchQuery, setSearchQuery] = useState('');
  const [addressingId, setAddressingId] = useState<string | null>(null);
  const [isManualOrderOpen, setIsManualOrderOpen] = useState(false);
  const [isTestingChime, setIsTestingChime] = useState(false);

  const handleTestChime = async () => {
    setIsTestingChime(true);
    try {
      await unlockAudioManually();
    } finally {
      setTimeout(() => setIsTestingChime(false), 1400);
    }
  };

  const pendingOrders = recentOrders.filter((order) => {
    if (!order) return false;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    return (
      String(order.order_number).includes(query) ||
      (order.customer_name || '').toLowerCase().includes(query) ||
      (order.customer_phone || '').includes(query) ||
      (order.delivery_address || '').toLowerCase().includes(query) ||
      (order.source || '').toLowerCase().includes(query)
    );
  });

  const handleAcknowledge = async (orderId: string) => {
    setAddressingId(orderId);
    try {
      await acknowledgeOrder(orderId);
    } finally {
      setAddressingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Pending Orders
            </h2>
            {pendingOrders.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-rose-500 text-white animate-pulse">
                {pendingOrders.length} to address
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time incoming orders awaiting kitchen acknowledgment.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => setIsManualOrderOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-chili-600 hover:bg-chili-700 text-white shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Walk-In Order</span>
          </button>

          <button
            type="button"
            onClick={toggleSound}
            className={`inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <VolumeX className="w-4 h-4 text-gray-400" />
            )}
            <span>Sound {soundEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={handleTestChime}
            disabled={isTestingChime}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center space-x-1.5 ${
              isTestingChime
                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border-emerald-400 animate-pulse'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-750'
            }`}
          >
            <span>{isTestingChime ? '🔔 Chiming...' : 'Test Chime'}</span>
          </button>
        </div>
      </div>

      {/* Browser Autoplay / Audio Suspended Banner */}
      {(!soundEnabled || !isAudioUnlocked) && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-2.5">
            <VolumeX className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 animate-pulse" />
            <span>
              {!soundEnabled
                ? 'Audio alerts are switched OFF. Click Enable to ensure kitchen staff hear incoming orders.'
                : 'Browser autoplay is holding audio in standby. Click "Enable Audio" so live order chimes play automatically.'}
            </span>
          </div>
          <button
            type="button"
            onClick={unlockAudioManually}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all active:scale-95 cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            🔊 Enable Audio Alerts
          </button>
        </div>
      )}

      {/* Search Input */}
      {recentOrders.length > 0 && (
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by order #, customer name, or phone..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-chili-500"
          />
        </div>
      )}

      {/* Orders Grid / Queue */}
      {pendingOrders.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="font-serif text-lg font-bold text-gray-900 dark:text-white">
            All Caught Up!
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1">
            There are no pending orders right now. When a customer places an order on the website, it will instantly appear here with an audio alert.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {pendingOrders.map((order) => {
            const isCelebration = Boolean(
              order.source &&
                (order.source.toLowerCase().includes('celebration') ||
                  order.source.toLowerCase().includes('reservation'))
            );
            const cleanPhone = (order.customer_phone || '').replace(/\D/g, '').slice(-10);
            const whatsappUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(
              isCelebration
                ? `Hello ${order.customer_name}! Regarding your Spicy Garden Celebration Booking #SG-${order.order_number}:`
                : `Hello ${order.customer_name}! Regarding your Spicy Garden order #SG-${order.order_number}:`
            )}`;
            const isHomeDelivery = Boolean(order.delivery_address);

            return (
              <div
                key={order.id}
                className={`bg-white dark:bg-gray-900 rounded-3xl border-2 ${
                  isCelebration
                    ? 'border-purple-300 dark:border-purple-800/70 shadow-purple-500/10'
                    : 'border-amber-300 dark:border-amber-800/60 shadow-amber-500/10'
                } shadow-lg p-5 flex flex-col justify-between space-y-4 relative overflow-hidden`}
              >
                {/* Urgent indicator strip */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${
                    isCelebration
                      ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500'
                      : 'bg-gradient-to-r from-amber-500 via-rose-500 to-chili-600'
                  }`}
                />

                <div>
                  {/* Top Bar: Order # and Time */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`font-mono font-extrabold text-sm px-2.5 py-1 rounded-xl border ${
                          isCelebration
                            ? 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900'
                            : 'bg-chili-50 dark:bg-chili-950 text-chili-600 border border-chili-200 dark:border-chili-900'
                        }`}
                      >
                        #SG-{order.order_number}
                      </span>
                      {isCelebration && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 flex items-center space-x-1">
                          <PartyPopper className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          <span>Celebration</span>
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-400 flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {order.created_at
                          ? new Date(order.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Just now'}
                      </span>
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="mt-3.5">
                    <h4 className="font-bold text-base text-gray-900 dark:text-white">
                      {order.customer_name}
                    </h4>
                    <div className="flex items-center space-x-3 mt-1.5">
                      <a
                        href={`tel:${cleanPhone}`}
                        className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-600 hover:underline"
                        title="Call Customer"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{order.customer_phone}</span>
                      </a>
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-1 text-xs font-semibold text-garden-600 hover:underline"
                        title="WhatsApp Customer"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>

                  {/* Order Type & Address / Celebration Occasion */}
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {isHomeDelivery ? (
                        <>
                          <MapPin className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                          <span className="text-[11px] leading-snug">
                            {order.delivery_address}
                          </span>
                        </>
                      ) : isCelebration ? (
                        <>
                          <Calendar className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                          <span className="text-[11px] text-purple-700 dark:text-purple-300 font-bold">
                            {order.source}
                          </span>
                        </>
                      ) : (
                        <>
                          {order.source?.toLowerCase().includes('dine-in') ? (
                            <Utensils className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                          ) : order.source?.toLowerCase().includes('phone') ? (
                            <Phone className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          ) : order.source?.toLowerCase().includes('counter') ? (
                            <Coffee className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          ) : (
                            <ShoppingBag className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                          )}
                          <span className="text-[11px]">
                            {order.source === 'Takeaway' ? 'Takeaway / Parcel' : (order.source || 'Takeaway / Parcel')}
                          </span>
                        </>
                      )}
                    </div>

                    {order.notes && (
                      <div
                        className={`mt-2 p-2.5 rounded-xl text-[11px] ${
                          isCelebration
                            ? 'bg-purple-50/70 dark:bg-purple-950/40 text-purple-950 dark:text-purple-200 border border-purple-200/60 dark:border-purple-900/40'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                        }`}
                      >
                        <strong>{isCelebration ? 'Reservation Details:' : 'Note:'}</strong> {order.notes}
                      </div>
                    )}
                  </div>

                  {/* Items List */}
                  <div className="mt-3.5 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                      {isCelebration ? 'Celebration / Reservation Details:' : 'Dishes Ordered:'}
                    </span>
                    {Array.isArray(order.items) &&
                      order.items.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs py-0.5"
                        >
                          <span className="text-gray-800 dark:text-gray-200 font-medium">
                            <span
                              className={`font-bold ${
                                isCelebration
                                  ? 'text-purple-600 dark:text-purple-400'
                                  : 'text-chili-600'
                              }`}
                            >
                              {item.quantity}x
                            </span>{' '}
                            {item.name}{' '}
                            {item.variant ? `(${item.variant})` : ''}
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {isCelebration && (!item.totalPrice || item.totalPrice === 0) ? (
                              <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                                Reserved
                              </span>
                            ) : (
                              `₹${item.totalPrice || item.price * (item.quantity || 1)}`
                            )}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Bottom Total & Acknowledge Button */}
                <div className="pt-3.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-400 block">
                      {isCelebration ? 'Booking Fee' : 'Order Total'}
                    </span>
                    <span className="text-lg font-extrabold font-sans text-gray-900 dark:text-white">
                      {isCelebration && order.total === 0 ? (
                        <span className="text-sm text-purple-600 dark:text-purple-400 font-bold">
                          Free Booking
                        </span>
                      ) : (
                        `₹${order.total}`
                      )}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={addressingId === order.id}
                    onClick={() => handleAcknowledge(order.id)}
                    className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-md shadow-emerald-600/25 disabled:opacity-50 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {addressingId === order.id ? 'Marking...' : 'Mark Handled'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Staff Walk-In Order POS Modal */}
      <ManualOrderModal
        isOpen={isManualOrderOpen}
        onClose={() => setIsManualOrderOpen(false)}
        onOrderCreated={() => {
          setIsManualOrderOpen(false);
        }}
      />
    </div>
  );
}
