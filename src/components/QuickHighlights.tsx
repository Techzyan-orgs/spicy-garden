"use client";

import React from "react";
import { RESTAURANT_DATA } from "@/data/restaurantData";
import { Sparkles, Tv, Utensils, Users, HeartHandshake, ShieldCheck } from "lucide-react";

export default function QuickHighlights() {
  const iconMap = {
    Utensils: Utensils,
    Sparkles: Sparkles,
    HeartHandshake: HeartHandshake,
    Tv: Tv,
    Users: Users,
    ShieldCheck: ShieldCheck,
    Clock: Sparkles,
  };

  return (
    <section className="py-12 bg-gray-50/70 dark:bg-gray-900/40 border-y border-gray-200/60 dark:border-gray-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs font-bold uppercase tracking-widest text-chili-600 dark:text-chili-400">
            Why Foodies Love The Spicy Garden
          </p>
          <h2 className="mt-1 font-serif text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Delicious Bites, Vibrant Vibe & Pocket-Friendly Value
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {RESTAURANT_DATA.usps.map((usp) => {
            const Icon = iconMap[usp.iconName] || Sparkles;
            return (
              <div
                key={usp.id}
                className="group relative p-5 rounded-2xl bg-white dark:bg-gray-800/70 border border-gray-200/80 dark:border-gray-700/60 shadow-sm hover:shadow-md hover:border-chili-500/40 dark:hover:border-chili-500/40 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-chili-50 dark:bg-chili-950/60 text-chili-600 dark:text-chili-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5" />
                </div>
                
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-garden-100 dark:bg-garden-950/80 text-garden-800 dark:text-garden-300 mb-2">
                  {usp.highlight}
                </span>

                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1.5 font-serif">
                  {usp.title}
                </h3>
                
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {usp.description}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
