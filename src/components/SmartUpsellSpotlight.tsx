'use client';

import React from 'react';
import { useCart } from '@/context/CartContext';
import { getDishImage } from '@/data/upsellRules';
import { Sparkles, Plus, X, Flame, ArrowRight, UtensilsCrossed } from 'lucide-react';

export default function SmartUpsellSpotlight() {
  const { activeUpsell, dismissUpsell, acceptUpsell } = useCart();

  if (!activeUpsell) return null;

  const item = activeUpsell.recommendedItem;
  const price = item.price;
  const image = getDishImage(item);

  return (
    <div className="w-full max-w-md sm:max-w-lg mb-3 pointer-events-auto animate-in slide-in-from-bottom-6 zoom-in-95 duration-400 ease-out">
      <div className="relative bg-gray-950/95 dark:bg-black/95 backdrop-blur-2xl border-2 border-amber-500/60 rounded-3xl p-3.5 sm:p-4 text-white shadow-[0_12px_45px_-8px_rgba(245,158,11,0.42)] ring-1 ring-amber-400/30 overflow-hidden group">
        {/* Animated Golden Accent Ambient Glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header: Social Proof Badge & Close Action */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-black tracking-wider bg-gradient-to-r from-amber-500/25 to-orange-500/25 text-amber-300 border border-amber-500/40 shadow-xs animate-pulse">
            <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span>{activeUpsell.socialProof}</span>
          </span>

          <button
            type="button"
            onClick={dismissUpsell}
            className="p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Dismiss suggestion"
            aria-label="Dismiss recommendation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Middle: Rich Food Photo, Copywriting & Combo Tag */}
        <div className="flex items-start space-x-3 sm:space-x-3.5 mb-3">
          {/* Dish Image (72x72px with glow ring) */}
          <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-2xl overflow-hidden flex-shrink-0 border-2 border-amber-500/40 bg-gray-900 shadow-md">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  const parent = (e.currentTarget as HTMLElement).parentElement;
                  if (parent) parent.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-amber-500 to-amber-700 text-black flex items-center justify-center">
                <UtensilsCrossed className="w-7 h-7 text-amber-100" />
              </div>
            )}

            {/* Veg / Non-Veg Indicator Badge */}
            <div className="absolute top-1 left-1 px-1 py-0.5 rounded bg-black/70 backdrop-blur-xs border border-white/20">
              <span className={`w-2 h-2 rounded-full block ${item.isVeg ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            </div>
          </div>

          {/* Persuasive Copy */}
          <div className="min-w-0 flex-1">
            <h4 className="font-serif text-xs sm:text-sm font-bold text-amber-300 tracking-tight leading-tight mb-0.5">
              {activeUpsell.headline}
            </h4>
            <p className="font-serif text-sm sm:text-base font-extrabold text-white truncate leading-snug">
              {activeUpsell.pitch}
            </p>
            <p className="text-[11px] sm:text-xs text-gray-300 leading-relaxed line-clamp-2 mt-1 font-sans">
              {activeUpsell.sensoryDescription}
            </p>

            {/* Visual Combo Equation Tag */}
            <div className="mt-1.5 inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[10px] font-semibold text-amber-300">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="truncate">{activeUpsell.comboTag}</span>
            </div>
          </div>
        </div>

        {/* Bottom Actions Row: Primary CTA with Shimmer & Secondary Dismiss */}
        <div className="flex items-center space-x-2 pt-1 border-t border-white/10">
          <button
            type="button"
            onClick={() => acceptUpsell(activeUpsell)}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-black text-black bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-200 active:scale-95 transition-all shadow-lg shadow-amber-500/30 flex items-center justify-center space-x-1.5 cursor-pointer relative overflow-hidden group/btn"
          >
            {/* Shimmer sweep effect */}
            <div className="absolute inset-0 -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Add to My Meal • ₹{price}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover/btn:translate-x-1" />
          </button>

          <button
            type="button"
            onClick={dismissUpsell}
            className="px-3 py-2.5 rounded-xl text-[11px] font-semibold text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}
