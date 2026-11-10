'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  Search,
  ShoppingBag,
  Printer,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  Phone,
  FileText,
  Utensils,
  MapPin,
  Clock,
  Sparkles,
  Coffee,
  Pizza,
  Sandwich
} from 'lucide-react';
import { DbOrder, OrderStatus, PaymentStatus, PaymentMode } from '@/types/restaurant';

export interface ManualOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: (newOrder: DbOrder, autoPrint: boolean) => void;
}

interface MenuItemOption {
  id: string;
  name: string;
  category: string;
  price: number;
  chickenPrice?: number;
  isVeg: boolean;
  isAvailable: boolean;
}

interface TrayItem {
  itemId: string;
  name: string;
  variant?: 'veg' | 'non-veg' | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

const ORDER_SOURCES = [
  { id: 'Dine-In', label: 'Dine-In', icon: Utensils },
  { id: 'Takeaway', label: 'Takeaway / Parcel', icon: ShoppingBag },
  { id: 'Phone Order', label: 'Phone Booking', icon: Phone },
  { id: 'Counter POS', label: 'Counter Walk-in', icon: Coffee },
] as const;

const TABLE_OPTIONS = ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Table 6', 'Outdoor 1', 'Outdoor 2'];

export default function ManualOrderModal({
  isOpen,
  onClose,
  onOrderCreated,
}: ManualOrderModalProps) {
  // Menu Data State
  const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [isLoadingMenu, setIsLoadingMenu] = useState<boolean>(true);

  // Filter & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Order Details
  const [orderSource, setOrderSource] = useState<string>('Dine-In');
  const [tableNumber, setTableNumber] = useState<string>('Table 1');
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('confirmed');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('paid');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Cart / Tray
  const [tray, setTray] = useState<TrayItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch the live menu (no built-in fallback: the database is the only source)
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadMenu = async () => {
      try {
        setIsLoadingMenu(true);
        const res = await fetch('/api/menu');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.items && Array.isArray(data.items)) {
            setMenuItems(
              data.items.map((i: any) => ({
                id: i.id,
                name: i.name,
                category: i.category,
                price: Number(i.price),
                chickenPrice: i.chickenPrice ? Number(i.chickenPrice) : undefined,
                isVeg: i.isVeg,
                isAvailable: i.isAvailable !== false,
              }))
            );
            if (data.categories && Array.isArray(data.categories)) {
              setCategories(data.categories);
            }
            return;
          }
        }
      } catch (err) {
        console.warn('[ManualOrderModal] Live menu load failed', err);
      }

      if (isMounted) {
        setMenuItems([]);
        setErrorMsg('Could not load the live menu. Close this window and try again in a moment.');
        setIsLoadingMenu(false);
      }
    };

    loadMenu().finally(() => {
      if (isMounted) setIsLoadingMenu(false);
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isSubmitting]);

  // Filtered menu items
  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCat =
        selectedCategory === 'all' ||
        item.category.toLowerCase() === selectedCategory.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || item.name.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Add Item to Tray
  const handleAddItem = (
    item: MenuItemOption,
    variant?: 'veg' | 'non-veg'
  ) => {
    const unitPrice =
      variant === 'non-veg' && item.chickenPrice
        ? item.chickenPrice
        : item.price;

    setTray((prev) => {
      const existingIdx = prev.findIndex(
        (t) => t.itemId === item.id && (variant ? t.variant === variant : !t.variant)
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        const current = updated[existingIdx];
        const nextQty = current.quantity + 1;
        updated[existingIdx] = {
          ...current,
          quantity: nextQty,
          totalPrice: nextQty * current.unitPrice,
        };
        return updated;
      }

      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          variant: variant || null,
          quantity: 1,
          unitPrice,
          totalPrice: unitPrice,
        },
      ];
    });
  };

  // Adjust Tray item quantity
  const handleUpdateQty = (index: number, delta: number) => {
    setTray((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const newQty = item.quantity + delta;

      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      }

      updated[index] = {
        ...item,
        quantity: newQty,
        totalPrice: newQty * item.unitPrice,
      };
      return updated;
    });
  };

  // Remove Item from Tray
  const handleRemoveItem = (index: number) => {
    setTray((prev) => prev.filter((_, i) => i !== index));
  };

  // Financial Calculations
  const grandTotal = useMemo(() => {
    return tray.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [tray]);

  const taxableSubtotal = useMemo(() => {
    return Math.round((grandTotal / 1.05) * 100) / 100;
  }, [grandTotal]);

  const totalGst = useMemo(() => {
    return Math.round((grandTotal - taxableSubtotal) * 100) / 100;
  }, [grandTotal, taxableSubtotal]);

  // Submit Order
  const handleSubmitOrder = async (autoPrint: boolean = false) => {
    if (tray.length === 0) {
      setErrorMsg('Please add at least one dish to the order.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const resolvedSource =
        orderSource === 'Dine-In' && tableNumber.trim()
          ? `Dine-In (${tableNumber.trim()})`
          : orderSource;

      const payload = {
        customerName: customerName.trim() || (orderSource === 'Dine-In' ? `${tableNumber.trim()} Guest` : 'Walk-in Guest'),
        customerPhone: customerPhone.trim() || '0000000000',
        items: tray.map((t) => ({
          itemId: t.itemId,
          variant: t.variant,
          quantity: t.quantity,
        })),
        source: resolvedSource,
        status: orderStatus,
        paymentStatus,
        paymentMode: paymentStatus === 'paid' ? paymentMode : undefined,
        notes: notes.trim() || undefined,
        deliveryAddress: deliveryAddress.trim() || undefined,
        isManual: true,
        idempotencyKey: `sg_pos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to record manual order.');
      }

      // Constructed DbOrder object for instantaneous optimistic UI update
      const createdOrder: DbOrder = data.order || {
        id: data.orderId,
        order_number: Number(String(data.orderNumber).replace(/\D/g, '')) || 0,
        customer_id: null,
        customer_name: payload.customerName,
        customer_phone: payload.customerPhone,
        items: tray as any,
        subtotal: data.subtotal || grandTotal,
        total: data.total || grandTotal,
        status: orderStatus,
        payment_status: paymentStatus,
        payment_mode: paymentStatus === 'paid' ? paymentMode : null,
        paid_at: paymentStatus === 'paid' ? new Date().toISOString() : null,
        source: resolvedSource,
        notes: payload.notes || null,
        delivery_address: deliveryAddress.trim() || null,
        idempotency_key: payload.idempotencyKey,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Broadcast update across windows/tabs
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sg_new_order', { detail: createdOrder }));
        try {
          const bc = new BroadcastChannel('sg_orders_channel');
          bc.postMessage({ type: 'NEW_ORDER', order: createdOrder });
          bc.close();
        } catch (e) {}
      }

      onOrderCreated(createdOrder, autoPrint);
      onClose();
    } catch (err: any) {
      console.error('[ManualOrderModal] Error submitting order:', err);
      setErrorMsg(err.message || 'Error creating order. Please check your network and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl h-[92vh] max-h-[900px] bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-gray-200 dark:border-gray-800">
        
        {/* ===================================================================== */}
        {/* TOP BAR: Title, Mode Badges & Close Button */}
        {/* ===================================================================== */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/70 dark:bg-gray-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-chili-600 text-white flex items-center justify-center shadow-md shadow-chili-600/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-serif font-bold text-lg text-gray-900 dark:text-white">
                  Create Manual Order (POS)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                  Staff Console
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Record dine-in, takeaway, or phone orders and generate thermal receipts
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ===================================================================== */}
        {/* MAIN BODY: 2-Column POS Layout */}
        {/* ===================================================================== */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* ----------------------------------------------------------------- */}
          {/* LEFT COLUMN: Menu Browser & Quick Add */}
          {/* ----------------------------------------------------------------- */}
          <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900">
            
            {/* Search & Category Filter Toolbar */}
            <div className="p-3 sm:p-4 border-b border-gray-100 dark:border-gray-800 space-y-2.5">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search dish by name (e.g. Pasta, Burger, Coffee)..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-chili-500 transition-all placeholder-gray-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all ${
                    selectedCategory === 'all'
                      ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  All Items ({menuItems.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1 rounded-xl font-bold whitespace-nowrap transition-all ${
                      selectedCategory.toLowerCase() === cat.id.toLowerCase()
                        ? 'bg-chili-600 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items Grid */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4">
              {isLoadingMenu ? (
                <div className="h-48 flex flex-col items-center justify-center space-y-2 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin text-chili-600" />
                  <span className="text-xs">Loading menu catalog...</span>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center space-y-2 text-gray-400">
                  <Utensils className="w-8 h-8 opacity-40" />
                  <span className="text-xs">No matching dishes found</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {filteredItems.map((item) => {
                    const hasDualPricing = Boolean(item.chickenPrice);
                    return (
                      <div
                        key={item.id}
                        className="p-2.5 sm:p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-700 transition-all flex flex-col justify-between space-y-2"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span
                                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  item.isVeg ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                                title={item.isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                              />
                              <h4 className="font-bold text-xs text-gray-900 dark:text-white line-clamp-1">
                                {item.name}
                              </h4>
                            </div>
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                              {item.category}
                            </span>
                          </div>

                          <span className="font-sans font-extrabold text-xs text-gray-900 dark:text-white">
                            ₹{item.price}
                          </span>
                        </div>

                        {/* Quick-Add Buttons */}
                        {hasDualPricing ? (
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => handleAddItem(item, 'veg')}
                              className="flex items-center justify-center space-x-1 py-1 px-1.5 rounded-lg text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 transition-colors active:scale-95"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Veg ₹{item.price}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddItem(item, 'non-veg')}
                              className="flex items-center justify-center space-x-1 py-1 px-1.5 rounded-lg text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 transition-colors active:scale-95"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Chicken ₹{item.chickenPrice}</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddItem(item)}
                            className="w-full flex items-center justify-center space-x-1 py-1 px-2 rounded-lg text-[11px] font-bold text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-chili-500 hover:text-chili-600 transition-colors active:scale-95"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add to Order (₹{item.price})</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* RIGHT COLUMN: Order Configuration, Tray & Settlement */}
          {/* ----------------------------------------------------------------- */}
          <div className="w-full lg:w-[420px] flex flex-col bg-gray-50/50 dark:bg-gray-900/50 overflow-hidden">
            
            {/* Scrollable Order Details & Active Tray */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* 1. Order Source Selector */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Order Type / Service
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ORDER_SOURCES.map((src) => {
                    const Icon = src.icon;
                    const isSelected = orderSource === src.id;
                    return (
                      <button
                        key={src.id}
                        type="button"
                        onClick={() => setOrderSource(src.id)}
                        className={`flex items-center space-x-2 p-2 rounded-xl border text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-chili-600 text-white border-chili-600 shadow-sm'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="truncate">{src.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Table Picker (Only shown for Dine-In) */}
              {orderSource === 'Dine-In' && (
                <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Table Number</span>
                    </span>
                    <input
                      type="text"
                      value={tableNumber}
                      onChange={(e) => setTableNumber(e.target.value)}
                      placeholder="e.g. Table 4"
                      className="w-28 px-2 py-0.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-900 text-xs font-bold text-gray-900 dark:text-white text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <div className="flex items-center space-x-1 overflow-x-auto pb-0.5 scrollbar-none">
                    {TABLE_OPTIONS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTableNumber(t)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap transition-all ${
                          tableNumber === t
                            ? 'bg-amber-800 text-white'
                            : 'bg-white dark:bg-gray-800 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Initial Status Selection */}
              <div>
                <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Initial Order Status
                </label>
                <div className="flex items-center space-x-1.5 text-xs font-bold">
                  {(['confirmed', 'preparing', 'completed'] as OrderStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setOrderStatus(st)}
                      className={`flex-1 py-1.5 px-2 rounded-xl capitalize transition-all border ${
                        orderStatus === st
                          ? 'bg-black text-white dark:bg-white dark:text-black border-transparent shadow-sm'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Customer Details (Optional) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Customer Info (Optional)
                  </label>
                  <span className="text-[10px] text-gray-400">Defaults to Walk-in</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Name (e.g. Rahul)"
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-chili-500"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Phone (10 digits)"
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-chili-500"
                    />
                  </div>
                </div>
                <div className="relative">
                  <FileText className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Cooking notes (e.g. Less spicy, extra cheese)..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-chili-500"
                  />
                </div>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Delivery Address / Landmark (optional, if delivery order)..."
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-1 focus:ring-chili-500"
                  />
                </div>
              </div>

              {/* 5. Payment Details */}
              <div className="space-y-2 p-3 rounded-2xl bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Payment Status
                  </label>
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                    paymentStatus === 'paid'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {paymentStatus === 'paid' ? '● Bill Paid' : '○ Unpaid'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('paid')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all border ${
                      paymentStatus === 'paid'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentStatus('unpaid')}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all border ${
                      paymentStatus === 'unpaid'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Unpaid / Later
                  </button>
                </div>

                {paymentStatus === 'paid' && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60 space-y-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      Payment Mode:
                    </span>
                    <div className="grid grid-cols-3 gap-1">
                      {(['cash', 'upi', 'card'] as PaymentMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setPaymentMode(mode)}
                          className={`py-1 px-1.5 rounded-lg text-[11px] font-bold uppercase transition-all border ${
                            paymentMode === mode
                              ? 'bg-gray-900 text-white dark:bg-white dark:text-black border-transparent shadow-sm'
                              : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Itemized Order Tray */}
              <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <span>Order Items</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-chili-100 text-chili-700 dark:bg-chili-950 dark:text-chili-300">
                      {tray.reduce((c, i) => c + i.quantity, 0)}
                    </span>
                  </span>

                  {tray.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTray([])}
                      className="text-[10px] text-rose-600 hover:underline font-bold"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {tray.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 text-center space-y-1 text-gray-400">
                    <ShoppingBag className="w-6 h-6 mx-auto opacity-50" />
                    <p className="text-xs font-semibold">No items added yet</p>
                    <p className="text-[10px]">Click any dish on the left to add to order</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {tray.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-1">
                            {item.variant && (
                              <span
                                className={`text-[9px] font-bold px-1 rounded ${
                                  item.variant === 'veg'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {item.variant === 'veg' ? 'V' : 'NV'}
                              </span>
                            )}
                            <h5 className="font-bold text-gray-900 dark:text-white truncate">
                              {item.name}
                            </h5>
                          </div>
                          <span className="text-[10px] text-gray-400">
                            ₹{item.unitPrice} each
                          </span>
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(idx, -1)}
                            className="w-5 h-5 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 flex items-center justify-center"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-bold font-sans">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(idx, 1)}
                            className="w-5 h-5 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 flex items-center justify-center"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="w-12 text-right font-bold font-sans">
                          ₹{item.totalPrice}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-gray-400 hover:text-rose-600 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Summary Bar & Action Buttons */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
              
              {/* Error Message */}
              {errorMsg && (
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-[11px] text-rose-700 dark:text-rose-300 flex items-center space-x-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Price Breakdown */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-gray-500">
                  <span>Net Item Subtotal:</span>
                  <span className="font-sans">₹{taxableSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-500 text-[11px]">
                  <span>GST 5% (CGST 2.5% + SGST 2.5%):</span>
                  <span className="font-sans">₹{totalGst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-baseline font-extrabold text-gray-900 dark:text-white pt-1 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-sm">Total Payable:</span>
                  <span className="text-xl font-sans text-chili-600 dark:text-chili-400">
                    ₹{grandTotal}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={isSubmitting || tray.length === 0}
                  onClick={() => handleSubmitOrder(false)}
                  className="w-full flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-xs font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShoppingBag className="w-3.5 h-3.5" />
                  )}
                  <span>Create Order</span>
                </button>

                <button
                  type="button"
                  disabled={isSubmitting || tray.length === 0}
                  onClick={() => handleSubmitOrder(true)}
                  className="w-full flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-black dark:bg-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 active:scale-95 shadow-md transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Printer className="w-3.5 h-3.5" />
                  )}
                  <span>Save &amp; Print Bill</span>
                </button>
              </div>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
