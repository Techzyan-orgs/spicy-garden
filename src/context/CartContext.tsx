'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ExtendedMenuItem, useMenuData } from '@/hooks/useMenuData';
import {
  UpsellRecommendation,
  findSmartUpsell,
  isEligibleForUpsellPill,
  recordUpsellPillShown,
  muteUpsellPillForSession,
  recordUpsellAccepted,
  resetUpsellAccepted,
  hasAcceptedAnyUpsell,
} from '@/data/upsellRules';

export interface CartItem {
  id: string; // Unique composite key: `${itemId}_${variant || 'standard'}`
  itemId: string;
  name: string;
  variant?: 'veg' | 'non-veg' | null;
  unitPrice: number;
  quantity: number;
  image?: string;
  category?: string;
}

interface CartContextType {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  isCartOpen: boolean;
  justAddedId: string | null;
  activeUpsell: UpsellRecommendation | null;
  hasAcceptedUpsell: boolean;
  dismissUpsell: () => void;
  acceptUpsell: (rec: UpsellRecommendation) => void;
  markUpsellAccepted: () => void;
  addItem: (
    item: {
      id: string;
      name: string;
      price: number;
      chickenPrice?: number;
      isVeg?: boolean;
      image?: string;
      image_url?: string;
      category?: string;
    },
    preference?: 'veg' | 'non-veg',
    quantity?: number
  ) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
  removeItem: (cartItemId: string) => void;
  clearCart: () => void;
  getItemQuantity: (itemId: string, variant?: 'veg' | 'non-veg') => number;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'sg_cart_items_v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [activeUpsell, setActiveUpsell] = useState<UpsellRecommendation | null>(null);
  const [hasAcceptedUpsell, setHasAcceptedUpsell] = useState(false);
  const upsellTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync initial upsell acceptance status from session
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHasAcceptedUpsell(hasAcceptedAnyUpsell());
    }
  }, []);

  // Connect to live database menu data for Single Source of Truth
  const { items: dbMenuItems } = useMenuData();

  // 1. Initial hydration from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setItems(parsed);
          }
        }
      } catch (e) {
        console.warn('[CartContext] Failed to load cart from storage:', e);
      } finally {
        setHasHydrated(true);
      }
    }
  }, []);

  // 2. Persist to localStorage whenever items change
  useEffect(() => {
    if (hasHydrated && typeof window !== 'undefined') {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch (e) {
        console.warn('[CartContext] Failed to save cart to storage:', e);
      }
    }
  }, [items, hasHydrated]);

  // 3. Database Single-Source-of-Truth synchronization
  // Validates cart against current live database prices and active stock availability
  useEffect(() => {
    if (!hasHydrated || !dbMenuItems || dbMenuItems.length === 0) return;

    setItems((prevItems) => {
      let changed = false;
      const dbMap = new Map(dbMenuItems.map((m) => [m.id, m]));
      const nextItems: CartItem[] = [];

      for (const cartItem of prevItems) {
        const dbItem = dbMap.get(cartItem.itemId);
        // If dish no longer exists or was marked unavailable in database, remove from cart
        if (!dbItem || dbItem.isAvailable === false) {
          changed = true;
          continue;
        }

        // Verify and update current unit price from authoritative database
        let currentPrice = dbItem.price;
        if (cartItem.variant === 'non-veg' && dbItem.chickenPrice) {
          currentPrice = dbItem.chickenPrice;
        }

        if (currentPrice !== cartItem.unitPrice) {
          nextItems.push({
            ...cartItem,
            unitPrice: currentPrice,
          });
          changed = true;
        } else {
          nextItems.push(cartItem);
        }
      }

      return changed ? nextItems : prevItems;
    });
  }, [dbMenuItems, hasHydrated]);

  // Add Item to Cart
  const addItem = useCallback(
    (
      item: {
        id: string;
        name: string;
        price: number;
        chickenPrice?: number;
        isVeg?: boolean;
        image?: string;
        image_url?: string;
        category?: string;
      },
      preference?: 'veg' | 'non-veg',
      quantityToAdd: number = 1
    ) => {
      const resolvedVariant = preference || (item.chickenPrice ? (item.isVeg ? 'veg' : 'non-veg') : null);
      const compositeId = `${item.id}_${resolvedVariant || 'standard'}`;

      // Calculate unit price based on variant
      const unitPrice =
        resolvedVariant === 'non-veg' && item.chickenPrice ? item.chickenPrice : item.price;

      setItems((prev) => {
        const existingIndex = prev.findIndex((i) => i.id === compositeId);
        if (existingIndex > -1) {
          const updated = [...prev];
          const newQty = Math.min(20, updated[existingIndex].quantity + quantityToAdd);
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: newQty,
            unitPrice,
          };
          return updated;
        } else {
          const newItem: CartItem = {
            id: compositeId,
            itemId: item.id,
            name: item.name,
            variant: resolvedVariant,
            unitPrice,
            quantity: Math.max(1, Math.min(20, quantityToAdd)),
            image: item.image || item.image_url,
            category: item.category,
          };
          return [...prev, newItem];
        }
      });

      // Micro-animation trigger
      setJustAddedId(compositeId);
      setTimeout(() => setJustAddedId(null), 800);

      // Intelligent subtle upselling trigger (fires only for high-converting anchor items with cooldown)
      if (isEligibleForUpsellPill() && dbMenuItems && dbMenuItems.length > 0) {
        const upsell = findSmartUpsell({
          newlyAddedItem: item,
          cartItems: items,
          allMenuItems: dbMenuItems,
        });

        if (upsell) {
          setActiveUpsell(upsell);
          recordUpsellPillShown();
        }
      }
    },
    [dbMenuItems, items]
  );

  // Dismiss subtle upsell pill and mute for current session
  const dismissUpsell = useCallback(() => {
    setActiveUpsell(null);
    muteUpsellPillForSession();
    if (upsellTimerRef.current) {
      clearTimeout(upsellTimerRef.current);
      upsellTimerRef.current = null;
    }
  }, []);

  // Accept subtle upsell in 1-click
  const acceptUpsell = useCallback(
    (rec: UpsellRecommendation) => {
      const targetItem = rec.recommendedItem;
      addItem(
        targetItem,
        targetItem.chickenPrice ? (targetItem.isVeg ? 'veg' : 'non-veg') : undefined,
        1
      );
      setActiveUpsell(null);
      recordUpsellAccepted();
      setHasAcceptedUpsell(true);
      if (upsellTimerRef.current) {
        clearTimeout(upsellTimerRef.current);
        upsellTimerRef.current = null;
      }
    },
    [addItem]
  );

  // Mark an upsell item as accepted (e.g. from in-tray recommendation list)
  const markUpsellAccepted = useCallback(() => {
    recordUpsellAccepted();
    setHasAcceptedUpsell(true);
    setActiveUpsell(null);
  }, []);

  // Update Item Quantity
  const updateQuantity = useCallback((cartItemId: string, delta: number) => {
    setItems((prev) => {
      return prev
        .map((item) => {
          if (item.id === cartItemId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: Math.min(20, newQty) } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  }, []);

  // Remove Item
  const removeItem = useCallback((cartItemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== cartItemId));
  }, []);

  // Clear Entire Cart
  const clearCart = useCallback(() => {
    setItems([]);
    resetUpsellAccepted();
    setHasAcceptedUpsell(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CART_STORAGE_KEY);
    }
  }, []);

  // Helper: Get quantity of a specific item & variant in cart
  const getItemQuantity = useCallback(
    (itemId: string, variant?: 'veg' | 'non-veg') => {
      const match = items.find((i) => {
        if (i.itemId !== itemId) return false;
        if (variant && i.variant) return i.variant === variant;
        return true;
      });
      return match ? match.quantity : 0;
    },
    [items]
  );

  const openCart = useCallback(() => {
    setActiveUpsell(null);
    setIsCartOpen(true);
  }, []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);

  const totalItems = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const totalPrice = useMemo(() => {
    return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        totalItems,
        totalPrice,
        isCartOpen,
        justAddedId,
        activeUpsell,
        hasAcceptedUpsell,
        dismissUpsell,
        acceptUpsell,
        markUpsellAccepted,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        getItemQuantity,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
