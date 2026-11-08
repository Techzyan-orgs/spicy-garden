'use client';

import React from 'react';
import { useCart } from '@/context/CartContext';
import { useCafeOperations } from '@/context/CafeOperationsContext';
import { ShoppingBag, ArrowRight } from 'lucide-react';
import SmartUpsellSpotlight from './SmartUpsellSpotlight';

export default function FloatingCartBar() {
  const { totalItems, totalPrice, isCartOpen, openCart, justAddedId } = useCart();
  const { isOpen: isCafeOpen } = useCafeOperations();

  // If cart is empty or currently open, hide floating bar
  if (totalItems === 0 || isCartOpen) {
    return null;
  }

  return (
    <div className="fixed bottom-16 sm:bottom-6 left-0 right-0 z-40 px-3 sm:px-4 flex flex-col items-center pointer-events-none animate-in slide-in-from-bottom-5 duration-300">
      {/* High-impact intelligent pairing spotlight */}
      <SmartUpsellSpotlight />

      <div
        onClick={openCart}
        className="pointer-events-auto max-w-md sm:max-w-lg w-full bg-gray-950/95 dark:bg-gray-900/95 text-white backdrop-blur-xl border border-chili-500/40 rounded-2xl shadow-2xl p-2 sm:p-2.5 flex items-center justify-between transition-all hover:border-chili-500/70 hover:shadow-chili-950/40 ring-1 ring-white/10 cursor-pointer group active:scale-[0.99]"
      >
        {/* Left: Animated Bag & Pricing */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="relative flex-shrink-0">
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${
                !isCafeOpen ? 'from-amber-600 to-orange-500' : 'from-chili-600 to-rose-500'
              } text-white flex items-center justify-center shadow-md transition-transform duration-300 ${
                justAddedId ? 'scale-110 rotate-6' : 'group-hover:scale-105'
              }`}
            >
              <ShoppingBag className="w-5 h-5" />
            </div>
            {/* Live Count Badge */}
            <span
              className={`absolute -top-1 -right-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                !isCafeOpen ? 'bg-amber-500' : 'bg-emerald-500'
              } text-white border-2 border-gray-950 shadow-sm transition-transform duration-300 ${
                justAddedId ? 'scale-125' : 'scale-100'
              }`}
            >
              {totalItems}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex items-baseline space-x-1.5">
              <span className="font-extrabold text-sm sm:text-base font-sans tracking-tight text-white">
                ₹{totalPrice}
              </span>
              <span className={`text-[10px] font-medium ${!isCafeOpen ? 'text-amber-400' : 'text-emerald-400'}`}>
                • {totalItems} {totalItems === 1 ? 'item' : 'items'}
              </span>
            </div>
            <p className={`text-[10.5px] truncate ${!isCafeOpen ? 'text-amber-300 font-semibold' : 'text-gray-300'}`}>
              {!isCafeOpen ? 'Café closed • Cart saved for when we open' : 'Tap to review tray & delivery location'}
            </p>
          </div>
        </div>

        {/* Right: Checkout Action Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openCart();
          }}
          className={`flex-shrink-0 flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white active:scale-95 transition-all shadow-md cursor-pointer ml-2 ${
            !isCafeOpen
              ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
              : 'bg-chili-600 hover:bg-chili-500 shadow-chili-600/30'
          }`}
        >
          <span>{!isCafeOpen ? 'Review Cart' : 'View Order'}</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}
