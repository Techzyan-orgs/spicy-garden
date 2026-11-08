"use client";

import React from "react";
import Image from "next/image";
import { RESTAURANT_DATA } from "@/data/restaurantData";
import { Cake, Heart, PartyPopper, Briefcase, Calendar, Check, Phone, ArrowRight } from "lucide-react";

interface OccasionsSectionProps {
  onOpenBooking: (occasion?: string) => void;
}

export default function OccasionsSection({ onOpenBooking }: OccasionsSectionProps) {
  const iconMap = {
    Cake: Cake,
    Heart: Heart,
    PartyPopper: PartyPopper,
    Briefcase: Briefcase,
    Smile: PartyPopper
  };

  return (
    <section id="occasions" className="py-20 bg-white dark:bg-gray-950 scroll-mt-20 border-t border-gray-200/60 dark:border-gray-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Banner Highlight Container */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-chili-900 via-stone-900 to-black text-white p-8 sm:p-12 lg:p-16 shadow-2xl mb-14 border border-chili-700/30">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            
            <div className="lg:col-span-8 space-y-4">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-amber-400 text-stone-950 shadow-sm">
                Party & Event Celebrations
              </span>

              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
                {RESTAURANT_DATA.brand.tagline}
              </h2>

              <p className="text-gray-300 text-sm sm:text-base max-w-2xl leading-relaxed">
                We organize <strong>ALL OCCASIONS</strong> such as Birthday Parties, Anniversaries, Kitty Parties, and Office Gatherings. With cozy air conditioning, signature murals, and appetizing menu packages, let us make your special day memorable!
              </p>

              <div className="pt-2 flex flex-wrap gap-4">
                <button
                  onClick={() => onOpenBooking("Birthday / Party Celebration")}
                  type="button"
                  className="px-6 py-3 rounded-xl font-bold text-sm bg-chili-600 hover:bg-chili-500 text-white shadow-lg shadow-chili-600/40 active:scale-95 transition-all flex items-center space-x-2"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Book Your Celebration With Us</span>
                </button>

                <a
                  href={RESTAURANT_DATA.contact.telLink}
                  className="px-5 py-3 rounded-xl font-semibold text-sm bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-all flex items-center space-x-2"
                >
                  <Phone className="w-4 h-4 text-amber-300" />
                  <span>Direct Hotline: {RESTAURANT_DATA.contact.displayPhone}</span>
                </a>
              </div>
            </div>

            {/* Storefront Banner Asset Thumbnail */}
            <div className="lg:col-span-4 flex justify-center lg:justify-end">
              <div className="relative w-48 sm:w-56 aspect-[9/16] rounded-2xl overflow-hidden shadow-2xl border-2 border-amber-400/50 group cursor-pointer" onClick={() => onOpenBooking("Party Celebration")}>
                <Image
                  src={RESTAURANT_DATA.assets.storefrontBanner}
                  alt="The Spicy Garden Official Occasion Celebration Board"
                  fill
                  loading="lazy"
                  sizes="(max-width: 768px) 192px, 224px"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
                  <span className="text-[11px] font-bold text-amber-300">
                    Official Storefront Board →
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Occasions Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {RESTAURANT_DATA.occasions.map((occ) => {
            const Icon = iconMap[occ.icon] || PartyPopper;
            return (
              <div
                key={occ.id}
                className="p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm hover:shadow-lg hover:border-chili-500/40 dark:hover:border-chili-500/40 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-chili-50 dark:bg-chili-950/70 text-chili-600 dark:text-chili-400 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6" />
                  </div>

                  <h3 className="font-serif text-lg font-bold text-gray-900 dark:text-white">
                    {occ.title}
                  </h3>
                  
                  <p className="text-xs font-semibold text-chili-600 dark:text-chili-400 mt-0.5 mb-2">
                    {occ.subtitle}
                  </p>

                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                    {occ.description}
                  </p>

                  <ul className="space-y-1.5 mb-6 text-xs text-gray-600 dark:text-gray-300">
                    {occ.benefits.map((b, i) => (
                      <li key={i} className="flex items-start space-x-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => onOpenBooking(occ.title)}
                  type="button"
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 hover:bg-chili-600 hover:text-white dark:hover:bg-chili-600 transition-colors"
                >
                  Book for {occ.title}
                </button>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
