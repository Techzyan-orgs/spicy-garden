'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useCart, CartItem } from '@/context/CartContext';
import { ExtendedMenuItem, useMenuData } from '@/hooks/useMenuData';
import { getCartComplements, getDishImage } from '@/data/upsellRules';
import { trackEvent } from '@/lib/analytics';
import {
  X,
  AlertCircle,
  Loader2,
  Plus,
  Minus,
  CheckCircle2,
  User,
  Phone,
  FileText,
  ShoppingBag,
  QrCode,
  Copy,
  Check,
  Sparkles,
  Flame,
  MapPin,
  Navigation,
  Trash2,
  ArrowRight,
  UtensilsCrossed,
  Clock,
} from 'lucide-react';
import { generateQrDataUrl } from '@/lib/qrCode';
import { RESTAURANT_UPI_ID, isUpiConfigured, buildUpiPaymentUrl } from '@/lib/publicConfig';
import { useCafeOperations } from '@/context/CafeOperationsContext';

interface OrderModalProps {
  onClose: () => void;
  item?: ExtendedMenuItem | null;
  preference?: 'veg' | 'non-veg';
}

export default function OrderModal({ onClose, item, preference }: OrderModalProps) {
  const {
    items: cartItems,
    totalItems,
    totalPrice,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    hasAcceptedUpsell,
    markUpsellAccepted,
  } = useCart();

  const {
    isOpen: isCafeOpen,
    statusText: cafeStatusText,
    nextStatusText: cafeNextStatusText,
    todayHoursDisplay,
  } = useCafeOperations();

  // Load menu data to derive smart pairing complements (suppressed if user already accepted a suggestion)
  const { items: allMenuItems } = useMenuData();
  const complements = useMemo(() => {
    if (hasAcceptedUpsell) return [];
    return getCartComplements({ cartItems, allMenuItems });
  }, [cartItems, allMenuItems, hasAcceptedUpsell]);

  // If a single item was passed as prop and cart is empty or doesn't have it, add it
  useEffect(() => {
    if (item) {
      const alreadyInCart = cartItems.some((ci) => ci.itemId === item.id);
      if (!alreadyInCart) {
        addItem(item, preference, 1);
      }
    }
  }, [item, preference, addItem, cartItems]);

  const [orderType, setOrderType] = useState<'delivery' | 'takeaway' | 'dine-in'>('delivery');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationStatus, setLocationStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string | null;
  }>({ type: null, message: null });
  const addressInputRef = useRef<HTMLInputElement | null>(null);

  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [confirmedItems, setConfirmedItems] = useState<CartItem[]>([]);
  const [confirmedTotal, setConfirmedTotal] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi'>('cash');
  const [upiConfirmed, setUpiConfirmed] = useState(false);
  const [upiRefId, setUpiRefId] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Restore saved details from localStorage for returning customers (excluding phone and orders, which are NOT kept in local storage)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('sg_customer_name') || '';
      const savedAddress = localStorage.getItem('sg_customer_address') || '';
      if (savedName) setCustomerName(savedName);
      if (savedAddress) setDeliveryAddress(savedAddress);
      // Deprecate and remove any locally stored phone or order caches from client devices
      localStorage.removeItem('sg_customer_phone');
      localStorage.removeItem('sg_orders_cache');
      localStorage.removeItem('sg_last_order_event');
    }
  }, []);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (!isSubmitting || isSuccess)) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isSubmitting, isSuccess]);

  // Prevent background page from scrolling while Order Tray is open, compensating for scrollbar width to prevent layout shift
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, []);

  // Track backdrop pointer down to prevent closing when dragging/selecting text from inside the modal out to the backdrop
  const isBackdropMouseDownRef = useRef(false);

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isBackdropMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleBackdropTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    isBackdropMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only dismiss if the pointer down began directly on the backdrop itself and ended on the backdrop
    if (isBackdropMouseDownRef.current && e.target === e.currentTarget && (!isSubmitting || isSuccess)) {
      onClose();
    }
    isBackdropMouseDownRef.current = false;
  };

  // Handler for automatic location detection with fallback
  const handleDetectLocation = () => {
    setLocationStatus({ type: null, message: null });

    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationStatus({
        type: 'error',
        message: 'Location detection is not supported by your browser. Please type your delivery address manually below.',
      });
      setTimeout(() => addressInputRef.current?.focus(), 100);
      return;
    }

    setIsDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setDeliveryCoordinates({ lat: latitude, lng: longitude });

        try {
          const res = await fetch(`/api/geocode/reverse?lat=${latitude}&lng=${longitude}`);
          const data = await res.json();

          if (res.ok && data.address) {
            setDeliveryAddress(data.address);
            setLocationStatus({
              type: 'success',
              message: 'Location detected! You can edit or add flat/landmark details below.',
            });
            if (typeof window !== 'undefined') {
              localStorage.setItem('sg_customer_address', data.address);
            }
          } else {
            const fallbackStr = `GPS Pin: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
            setDeliveryAddress(fallbackStr);
            setLocationStatus({
              type: 'success',
              message: 'GPS coordinates detected. Please add your house/landmark details below.',
            });
          }
        } catch {
          const fallbackStr = `GPS Pin: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          setDeliveryAddress(fallbackStr);
          setLocationStatus({
            type: 'success',
            message: 'GPS coordinates detected. Please add your house/landmark details below.',
          });
        } finally {
          setIsDetectingLocation(false);
          setTimeout(() => addressInputRef.current?.focus(), 100);
        }
      },
      (error) => {
        setIsDetectingLocation(false);
        let msg = 'Could not fetch your location. Please enter your delivery address manually below.';
        if (error.code === 1) {
          msg = 'Location permission denied. Please enter your delivery address manually below.';
        } else if (error.code === 2) {
          msg = 'Location signal unavailable. Please enter your delivery address manually below.';
        } else if (error.code === 3) {
          msg = 'Location request timed out. Please enter your delivery address manually below.';
        }
        setLocationStatus({
          type: 'error',
          message: msg,
        });
        setTimeout(() => addressInputRef.current?.focus(), 100);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const upiVpa = RESTAURANT_UPI_ID;
  const upiPayUrl = buildUpiPaymentUrl(
    totalPrice,
    `Order ${cartItems.length > 0 ? cartItems[0].name.slice(0, 15) : 'Meal'}`
  );
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    if (!upiPayUrl) return;
    generateQrDataUrl(upiPayUrl, 160).then((dataUrl) => {
      if (dataUrl) setQrCodeUrl(dataUrl);
    });
  }, [upiPayUrl]);

  const handleCopyUpi = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(upiVpa);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2500);
    }
  };

  const handleAddMoreDishes = () => {
    onClose();
    if (typeof window !== 'undefined') {
      const menuEl = document.getElementById('menu');
      if (menuEl) {
        menuEl.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (cartItems.length === 0) {
      setErrorMsg('Your order tray is empty. Please add items to proceed.');
      return;
    }

    if (!isCafeOpen) {
      setErrorMsg(
        `The café is currently closed (${cafeStatusText || 'Not accepting orders'}). Your items are safely saved in your cart and will be ready when we open!`
      );
      return;
    }

    const trimmedName = customerName.trim();
    if (trimmedName.length < 2) {
      setErrorMsg('Please enter your full name (at least 2 characters).');
      return;
    }

    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    const trimmedAddress = deliveryAddress.trim();
    if (orderType === 'delivery' && trimmedAddress.length < 3) {
      setErrorMsg('Please provide your delivery address or click "Auto-Detect My Location".');
      setTimeout(() => addressInputRef.current?.focus(), 100);
      return;
    }

    setIsSubmitting(true);

    try {
      // Save non-sensitive customer details for future orders (phone is stored in Firebase RTDB on server, never in local storage)
      if (typeof window !== 'undefined') {
        localStorage.setItem('sg_customer_name', trimmedName);
        localStorage.removeItem('sg_customer_phone');
        if (orderType === 'delivery' && trimmedAddress) {
          localStorage.setItem('sg_customer_address', trimmedAddress);
        }
      }

      const idempotencyKey = `sg_ord_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const isAdvanceUPI = paymentMode === 'upi';
      const resolvedPaymentStatus = 'unpaid';

      // Format payload with all cart items
      const payloadItems = cartItems.map((item) => ({
        itemId: item.itemId,
        variant: item.variant || undefined,
        quantity: item.quantity,
      }));

      // Post order to server
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: trimmedName,
          customerPhone: cleanPhone,
          items: payloadItems,
          notes: notes.trim() || undefined,
          deliveryAddress: orderType === 'delivery' ? trimmedAddress : undefined,
          deliveryCoordinates: orderType === 'delivery' && deliveryCoordinates ? deliveryCoordinates : undefined,
          orderType,
          idempotencyKey,
          paymentStatus: resolvedPaymentStatus,
          paymentMode: paymentMode,
          upiTransactionId: upiRefId.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.isClosed) {
          setErrorMsg(
            data.error || 'The café is currently closed. Your items are safely saved in your cart!'
          );
          return;
        }
        throw new Error(data.error || 'Failed to submit order.');
      }

      setConfirmedItems([...cartItems]);
      setConfirmedTotal(data.total || totalPrice);
      setIsSuccess(true);

      // Track analytics
      trackEvent('order_placed', {
        itemCount: cartItems.length,
        totalItems,
        total: data.total || totalPrice,
      });

      // Clear the cart now that order is confirmed
      clearCart();

      // Instant notification broadcast to open admin tabs/windows
      if (typeof window !== 'undefined') {
        const orderPayload = {
          id: data.orderId || `ord_${Date.now()}`,
          order_number: data.orderNumber
            ? String(data.orderNumber).replace(/\D/g, '')
            : `${Math.floor(1000 + Math.random() * 9000)}`,
          customer_name: trimmedName,
          customer_phone: cleanPhone,
          items: data.items || cartItems.map((c) => ({
            name: c.name,
            variant: c.variant,
            quantity: c.quantity,
            unitPrice: c.unitPrice,
            totalPrice: c.unitPrice * c.quantity,
          })),
          total: data.total || totalPrice,
          notes: notes.trim() || undefined,
          delivery_address: orderType === 'delivery' ? trimmedAddress : null,
          delivery_coordinates: orderType === 'delivery' ? deliveryCoordinates : null,
          source: orderType === 'delivery' ? 'Home Delivery' : orderType === 'dine-in' ? 'Dine-In' : 'Takeaway',
          status: 'pending',
          payment_status: resolvedPaymentStatus,
          payment_mode: paymentMode,
          upi_transaction_id: upiRefId.trim() || null,
          paid_at: isAdvanceUPI ? new Date().toISOString() : null,
          created_at: new Date().toISOString(),
        };

        // Order has been successfully ingested by /api/orders and broadcast via Ably pub/sub.
        // Customer device does NOT store order caches in localStorage.
        try {
          localStorage.removeItem('sg_orders_cache');
          localStorage.removeItem('sg_last_order_event');
        } catch (e) {}
      }
    } catch (err: any) {
      console.error('[OrderModal] Submission error:', err);
      setErrorMsg(err?.message || 'Failed to place order. Please try again or call us directly.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onMouseDown={handleBackdropMouseDown}
      onTouchStart={handleBackdropTouchStart}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overscroll-contain"
    >
      <div
        onMouseDown={(e) => {
          isBackdropMouseDownRef.current = false;
          e.stopPropagation();
        }}
        onTouchStart={() => {
          isBackdropMouseDownRef.current = false;
        }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white dark:bg-gray-900 rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col p-4 sm:p-5 border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden overscroll-contain"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting && !isSuccess}
          className="absolute top-3.5 right-3.5 p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer z-10"
          aria-label="Close order dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {isSuccess ? (
          /* ========================================================================= */
          /* SUCCESS SCREEN (Multi-Item Order Confirmation)                            */
          /* ========================================================================= */
          <div className="overflow-y-auto overscroll-y-contain py-4 text-center flex flex-col items-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold font-serif text-gray-900 dark:text-white">
              Order Placed Successfully!
            </h3>

            {/* Payment Summary Banner */}
            {paymentMode === 'upi' ? (
              <div className="mt-3 px-3.5 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-center w-full max-w-xs">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Paid in Advance via UPI (₹{confirmedTotal})</span>
                </span>
                {upiRefId && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                    UTR: {upiRefId}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-3 px-3.5 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-center w-full max-w-xs">
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  Payment: ₹{confirmedTotal} (Pay on Delivery - Cash / UPI)
                </span>
              </div>
            )}

            {/* Ordered Items Summary */}
            <div className="mt-3 w-full max-w-sm rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 p-3 text-left">
              <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1.5 uppercase tracking-wider">
                Ordered Items ({confirmedItems.reduce((s, i) => s + i.quantity, 0)} dishes):
              </span>
              <div className="space-y-1 divide-y divide-gray-100 dark:divide-gray-700/60">
                {confirmedItems.map((item) => (
                  <div key={item.id} className="pt-1 flex items-center justify-between text-xs">
                    <span className="text-gray-800 dark:text-gray-200 font-medium">
                      {item.quantity}x {item.name} {item.variant ? `(${item.variant})` : ''}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      ₹{item.unitPrice * item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 text-xs text-gray-600 dark:text-gray-300 max-w-sm leading-relaxed text-center">
              Thank you, <strong>{customerName}</strong>! Your order has been sent to our kitchen.
              {orderType === 'delivery' && deliveryAddress && (
                <span className="block mt-1.5 p-2 rounded-xl bg-gray-50 dark:bg-gray-800 text-[11px] text-gray-700 dark:text-gray-300 text-left border border-gray-100 dark:border-gray-700">
                  <span className="font-bold block text-gray-900 dark:text-white">📍 Delivery to:</span>
                  <span className="line-clamp-2">{deliveryAddress}</span>
                </span>
              )}
              {orderType === 'takeaway' && (
                <span className="block mt-1.5 p-2 rounded-xl bg-gray-50 dark:bg-gray-800 text-[11px] text-gray-700 dark:text-gray-300 text-left border border-gray-100 dark:border-gray-700">
                  <span className="font-bold block text-gray-900 dark:text-white">🛍️ Takeaway / Parcel:</span>
                  <span>Ready for counter pickup at The Spicy Garden, Station Road, Panskura.</span>
                </span>
              )}
              {orderType === 'dine-in' && (
                <span className="block mt-1.5 p-2 rounded-xl bg-gray-50 dark:bg-gray-800 text-[11px] text-gray-700 dark:text-gray-300 text-left border border-gray-100 dark:border-gray-700">
                  <span className="font-bold block text-gray-900 dark:text-white">🍽️ Dine-In Order:</span>
                  <span>Our team will prepare your dishes fresh and serve them right to your table!</span>
                </span>
              )}
              <span className="block mt-1">
                We will call you on <strong>{customerPhone}</strong> to confirm your order!
              </span>
            </div>

            <div className="mt-5 flex items-center justify-center w-full">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-chili-600 hover:bg-chili-700 shadow-md shadow-chili-600/30 transition-all active:scale-95 cursor-pointer"
              >
                Back to Menu
              </button>
            </div>
          </div>
        ) : cartItems.length === 0 ? (
          /* ========================================================================= */
          /* EMPTY CART STATE                                                          */
          /* ========================================================================= */
          <div className="py-12 px-4 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
              <UtensilsCrossed className="w-8 h-8" />
            </div>
            <div className="space-y-1 max-w-xs">
              <h3 className="font-serif text-lg font-bold text-gray-900 dark:text-white">
                Your Order Tray is Empty
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Add fresh artisanal pizzas, burgers, momos, or pastas to build your delicious meal.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddMoreDishes}
              className="mt-2 inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-chili-600 hover:bg-chili-700 shadow-md shadow-chili-600/25 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Explore Delicious Menu</span>
            </button>
          </div>
        ) : (
          /* ========================================================================= */
          /* ACTIVE MULTI-ITEM ORDER TRAY & CHECKOUT FORM                              */
          /* ========================================================================= */
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-gray-800 flex-shrink-0 pr-8">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-chili-100 dark:bg-chili-950/70 text-chili-600 dark:text-chili-400 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight">
                    Your Order Tray
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                    {totalItems} {totalItems === 1 ? 'item' : 'items'} selected
                  </p>
                </div>
              </div>

              {/* Clear Cart Button */}
              {cartItems.length > 1 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-[11px] font-medium text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors flex items-center space-x-1 cursor-pointer"
                  title="Remove all items from tray"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear All</span>
                </button>
              )}
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div className="mt-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2 flex-shrink-0 animate-in fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Café Closed Notice Banner */}
            {!isCafeOpen && (
              <div className="mt-2.5 p-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-300 dark:border-amber-800/60 flex items-start space-x-2.5 flex-shrink-0 animate-in fade-in">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-amber-900 dark:text-amber-200">
                    Café is Currently Closed ({cafeStatusText || 'Orders Paused'})
                  </p>
                  <p className="text-amber-800/90 dark:text-amber-300/90 mt-0.5 leading-relaxed">
                    We are not accepting orders at this time. <strong>Your {totalItems} {totalItems === 1 ? 'item is' : 'items are'} safely saved in your cart</strong> so you can place your order as soon as we open ({cafeNextStatusText || todayHoursDisplay}).
                  </p>
                </div>
              </div>
            )}

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto overscroll-y-contain pr-1 space-y-3 py-2.5">
              {/* =================================================================== */}
              {/* ITEM LIST CARDS WITH LIVE STEPPERS                                  */}
              {/* =================================================================== */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-gray-500 dark:text-gray-400 px-1">
                  <span>Selected Dishes</span>
                  <span>Quantity &amp; Price</span>
                </div>

                <div className="space-y-2">
                  {cartItems.map((cartItem) => (
                    <div
                      key={cartItem.id}
                      className="p-2.5 rounded-2xl bg-gray-50/80 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-800 flex items-center justify-between gap-2.5 group transition-all"
                    >
                      {/* Dish Thumbnail & Name */}
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        {cartItem.image ? (
                          <div className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={cartItem.image}
                              alt={cartItem.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const parent = (e.currentTarget as HTMLElement).parentElement;
                                if (parent) parent.style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 text-gray-500">
                            <UtensilsCrossed className="w-4 h-4" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <h4 className="font-serif text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">
                            {cartItem.name}
                          </h4>
                          <div className="flex items-center space-x-1.5 text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {cartItem.variant && (
                              <span
                                className={`font-semibold flex items-center space-x-1 ${
                                  cartItem.variant === 'veg'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                <span>{cartItem.variant === 'veg' ? '🟢 Veg' : '🔴 Non-Veg'}</span>
                              </span>
                            )}
                            <span>• ₹{cartItem.unitPrice} each</span>
                          </div>
                        </div>
                      </div>

                      {/* Stepper Controls & Line Price */}
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        {/* Stepper */}
                        <div className="flex items-center space-x-1 p-0.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xs">
                          <button
                            type="button"
                            onClick={() => updateQuantity(cartItem.id, -1)}
                            disabled={isSubmitting}
                            className="w-6 h-6 rounded text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors disabled:opacity-40"
                            title={cartItem.quantity === 1 ? 'Remove dish' : 'Decrease quantity'}
                          >
                            {cartItem.quantity === 1 ? (
                              <Trash2 className="w-3 h-3 text-rose-500" />
                            ) : (
                              <Minus className="w-3 h-3" />
                            )}
                          </button>
                          <span className="font-bold text-xs text-gray-900 dark:text-white w-5 text-center font-sans">
                            {cartItem.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(cartItem.id, 1)}
                            disabled={cartItem.quantity >= 20 || isSubmitting}
                            className="w-6 h-6 rounded text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors disabled:opacity-40"
                            title="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Line Total */}
                        <span className="font-extrabold text-xs sm:text-sm text-gray-900 dark:text-white font-sans min-w-[42px] text-right">
                          ₹{cartItem.unitPrice * cartItem.quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add More Dishes Button */}
                <button
                  type="button"
                  onClick={handleAddMoreDishes}
                  className="w-full py-2 px-3 rounded-xl border border-dashed border-chili-300 dark:border-chili-800/80 hover:border-chili-500 text-chili-700 dark:text-chili-300 hover:bg-chili-50/50 dark:hover:bg-chili-950/30 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add More Dishes from Menu</span>
                </button>
              </div>

              {/* High-Impact In-Tray "Complete Your Feast" Section */}
              {complements.length > 0 && (
                <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-b from-amber-500/10 to-amber-500/5 dark:from-amber-950/40 dark:to-amber-950/20 border-2 border-amber-500/30 dark:border-amber-500/30 shadow-xs animate-in fade-in duration-300">
                  <div className="flex items-center justify-between mb-2 px-0.5">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-5 h-5 rounded-md bg-gradient-to-tr from-amber-500 to-orange-500 text-black flex items-center justify-center shadow-xs">
                        <Sparkles className="w-3 h-3 fill-amber-100" />
                      </span>
                      <span className="text-xs font-serif font-black text-gray-900 dark:text-amber-200 tracking-tight">
                        Complete Your Feast • Chef&apos;s Complements
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-200/60 dark:bg-amber-900/60 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      1-Click Add
                    </span>
                  </div>

                  {/* Clean Vertical Stack (Full width per item - No clumsy truncation!) */}
                  <div className="space-y-2">
                    {complements.map((comp) => {
                      const dish = comp.recommendedItem;
                      const dishImg = getDishImage(dish);
                      return (
                        <div
                          key={dish.id}
                          className="flex items-center justify-between p-2.5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-amber-400 dark:hover:border-amber-500/60 shadow-xs transition-all gap-2.5 group"
                        >
                          {/* Dish Thumbnail with dietary indicator */}
                          <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800 border border-amber-500/30">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={dishImg}
                              alt={dish.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = '/unnamed (2).webp';
                              }}
                            />
                            <span
                              className={`absolute top-1 left-1 w-2 h-2 rounded-full ring-1 ring-black/40 ${
                                dish.isVeg ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                          </div>

                          {/* Dish Info with FULL readable text (No clumsy truncate!) */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-1 mb-0.5">
                              <span className="text-[9.5px] font-black uppercase text-amber-600 dark:text-amber-400 flex items-center space-x-1">
                                <Flame className="w-3 h-3 fill-amber-500 text-amber-500 inline flex-shrink-0" />
                                <span className="line-clamp-1">{comp.socialProof}</span>
                              </span>
                            </div>

                            <h5 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white font-serif leading-snug">
                              {dish.name}
                            </h5>

                            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                              {dish.description || comp.sensoryDescription}
                            </p>
                          </div>

                          {/* 1-Click Add Action Button */}
                          <button
                            type="button"
                            onClick={() => {
                              markUpsellAccepted();
                              addItem(
                                dish,
                                dish.chickenPrice ? (dish.isVeg ? 'veg' : 'non-veg') : undefined,
                                1
                              );
                            }}
                            className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-black shadow-xs active:scale-95 transition-all flex items-center space-x-1 cursor-pointer ml-1 whitespace-nowrap"
                            title={`Add ${dish.name} to order tray`}
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[3]" />
                            <span>Add • ₹{dish.price}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Order Service Type Toggle (Delivery vs Takeaway) */}
              <div className="space-y-1 pt-1">
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                  Service Type
                </label>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderType('delivery')}
                    className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center space-x-1 sm:space-x-1.5 ${
                      orderType === 'delivery'
                        ? 'border-chili-500 bg-chili-50/80 dark:bg-chili-950/60 text-chili-700 dark:text-chili-300 font-bold shadow-xs ring-1 ring-chili-500'
                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300 text-xs font-medium'
                    }`}
                  >
                    <span>🛵</span>
                    <span className="text-[11px] sm:text-xs">Home Delivery</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderType('takeaway')}
                    className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center space-x-1 sm:space-x-1.5 ${
                      orderType === 'takeaway'
                        ? 'border-chili-500 bg-chili-50/80 dark:bg-chili-950/60 text-chili-700 dark:text-chili-300 font-bold shadow-xs ring-1 ring-chili-500'
                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300 text-xs font-medium'
                    }`}
                  >
                    <span>🛍️</span>
                    <span className="text-[11px] sm:text-xs">Takeaway</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrderType('dine-in')}
                    className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer flex items-center justify-center space-x-1 sm:space-x-1.5 ${
                      orderType === 'dine-in'
                        ? 'border-chili-500 bg-chili-50/80 dark:bg-chili-950/60 text-chili-700 dark:text-chili-300 font-bold shadow-xs ring-1 ring-chili-500'
                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300 text-xs font-medium'
                    }`}
                  >
                    <span>🍽️</span>
                    <span className="text-[11px] sm:text-xs">Dine-In</span>
                  </button>
                </div>
              </div>

              {/* Customer Name & Phone in 2-Column Responsive Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Your Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Suman Sengupta"
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs focus:ring-2 focus:ring-chili-500 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Mobile Phone <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs focus:ring-2 focus:ring-chili-500 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery Address & Location Section */}
              {orderType === 'delivery' ? (
                <div className="p-2.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 space-y-2">
                  <div className="flex items-center justify-between gap-1.5">
                    <label className="text-[11px] font-bold text-gray-800 dark:text-gray-200 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-chili-600" />
                      <span>Delivery Address / Location <span className="text-rose-500">*</span></span>
                    </label>

                    {/* Auto-Detect Location Button */}
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={isDetectingLocation || isSubmitting}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 border border-emerald-300/80 dark:border-emerald-800 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-xs"
                      title="Fetch your current location automatically using GPS"
                    >
                      {isDetectingLocation ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                          <span>Detecting GPS...</span>
                        </>
                      ) : (
                        <>
                          <Navigation className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>Auto-Detect Location</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Location Status Feedback Banner */}
                  {locationStatus.message && (
                    <div
                      className={`px-2 py-1.5 rounded-lg text-[11px] flex items-center space-x-1.5 ${
                        locationStatus.type === 'success'
                          ? 'bg-emerald-100/90 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                          : 'bg-rose-100/90 dark:bg-rose-950/90 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                      }`}
                    >
                      {locationStatus.type === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                      )}
                      <span className="leading-tight text-[10.5px]">{locationStatus.message}</span>
                    </div>
                  )}

                  {/* Manual Address Input / Editable Text Field */}
                  <div className="relative">
                    <input
                      ref={addressInputRef}
                      type="text"
                      required={orderType === 'delivery'}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="e.g. Flat/House No., Street, Landmark, Panskura"
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs focus:ring-2 focus:ring-chili-500 text-gray-900 dark:text-white"
                    />
                    <MapPin className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                    Type your address or use auto-detect. You can freely edit or append flat/floor details anytime.
                  </p>
                </div>
              ) : orderType === 'takeaway' ? (
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 text-[11px] text-gray-600 dark:text-gray-300 flex items-start space-x-2">
                  <span className="text-sm flex-shrink-0">🛍️</span>
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">Takeaway / Parcel Pickup</p>
                    <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Pickup directly from our counter at <strong>The Spicy Garden</strong>, Station Road, Panskura.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-800 text-[11px] text-gray-600 dark:text-gray-300 flex items-start space-x-2">
                  <span className="text-sm flex-shrink-0">🍽️</span>
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">Dine-In Seating</p>
                    <p className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Enjoy your meal at <strong>The Spicy Garden</strong>! Our team will prepare your dishes fresh and serve them right to your table.
                    </p>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Special Notes / Cooking Request (Optional)
                </label>
                <div className="relative">
                  <FileText className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Extra napkins, less spicy, call when downstairs"
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs focus:ring-2 focus:ring-chili-500 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-1.5 pt-0.5">
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                  Payment Preference
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('cash')}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      paymentMode === 'cash'
                        ? 'border-chili-500 bg-chili-50/70 dark:bg-chili-950/40 text-gray-900 dark:text-white shadow-sm ring-1 ring-chili-500'
                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Pay on Delivery</span>
                      <span className="text-sm">🛵</span>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Pay when delivered (Cash / UPI)
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('upi')}
                    disabled={!isUpiConfigured}
                    title={isUpiConfigured ? undefined : 'UPI payment is not available right now'}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      paymentMode === 'upi'
                        ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-gray-900 dark:text-white shadow-sm ring-1 ring-emerald-500'
                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Pay via UPI</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-500 text-white uppercase">
                          Advance
                        </span>
                      </div>
                      <span className="text-sm">⚡</span>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Instant QR &amp; Any UPI App
                    </p>
                  </button>
                </div>

                {/* Advance UPI Panel */}
                {paymentMode === 'upi' && (
                  <div className="p-2.5 rounded-2xl bg-gradient-to-b from-emerald-50/90 to-white dark:from-emerald-950/50 dark:to-gray-900 border border-emerald-300 dark:border-emerald-800 space-y-2 mt-1.5">
                    <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-900/60 pb-1.5 gap-2">
                      <div className="flex items-baseline space-x-1.5">
                        <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">
                          Total UPI Pay:
                        </span>
                        <span className="text-xs font-extrabold text-gray-900 dark:text-white">
                          ₹{totalPrice}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-700 px-2 py-0.5 rounded-lg flex-shrink-0">
                        <span className="text-[10px] font-mono font-bold text-gray-800 dark:text-gray-200">
                          {upiVpa}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyUpi}
                          className="ml-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer"
                        >
                          {copiedUpi ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                      {/* QR Code */}
                      <div className="sm:col-span-4 p-1.5 bg-white rounded-xl border border-emerald-200 shadow-sm flex flex-col items-center justify-center text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={qrCodeUrl}
                          alt="Scan UPI QR"
                          width={80}
                          height={80}
                          className="w-20 h-20 object-contain"
                        />
                        <span className="text-[8.5px] font-bold text-gray-700 block mt-0.5">
                          Scan to Pay ₹{totalPrice}
                        </span>
                      </div>

                      <div className="sm:col-span-8 text-xs space-y-1.5 text-gray-600 dark:text-gray-300 w-full">
                        {/* Mobile Direct Pay Button */}
                        <a
                          href={upiPayUrl}
                          className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
                        >
                          <span>⚡ Pay via UPI App (GPay / PhonePe)</span>
                        </a>

                        {/* Optional UTR / Reference */}
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-700 dark:text-gray-300 mb-0.5">
                            UPI Ref / UTR Number (Optional)
                          </label>
                          <input
                            type="text"
                            value={upiRefId}
                            onChange={(e) => setUpiRefId(e.target.value)}
                            placeholder="e.g. 12-digit transaction number"
                            className="w-full px-2.5 py-1 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>

                        <label className="flex items-center space-x-1.5 cursor-pointer pt-0.5">
                          <input
                            type="checkbox"
                            checked={upiConfirmed}
                            onChange={(e) => setUpiConfirmed(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          />
                          <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">
                            I have sent ₹{totalPrice} via UPI
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pinned Bottom Total & Action */}
            <div className="pt-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0 bg-white dark:bg-gray-900 mt-auto">
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider block">
                  Total ({totalItems} {totalItems === 1 ? 'dish' : 'dishes'})
                </span>
                <p className="text-lg font-extrabold text-gray-900 dark:text-white font-sans">
                  ₹{totalPrice}
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || cartItems.length === 0 || !isCafeOpen}
                className={`flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition-all disabled:opacity-75 cursor-pointer ${
                  !isCafeOpen
                    ? 'bg-gray-400 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-700 cursor-not-allowed shadow-none active:scale-100'
                    : paymentMode === 'upi'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
                    : 'bg-chili-600 hover:bg-chili-700 shadow-chili-600/25'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Placing Order...</span>
                  </>
                ) : !isCafeOpen ? (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>Café Closed • Cart Saved</span>
                  </>
                ) : paymentMode === 'upi' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm &amp; Place Paid Order</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Confirm &amp; Place Order (₹{totalPrice})</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
