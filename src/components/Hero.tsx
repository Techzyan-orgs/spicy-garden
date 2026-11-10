"use client";

import React from "react";
import Image from "next/image";
import { RESTAURANT_DATA } from "@/data/restaurantData";
import { useCafeOperations } from "@/context/CafeOperationsContext";
import { useGoogleRating } from "@/hooks/useGoogleRating";
import { Star, Flame, Calendar, MessageCircle, ArrowRight, Clock, MapPin, Sparkles } from "lucide-react";

interface HeroProps {
  onOpenBooking: (occasion?: string) => void;
}

export default function Hero({ onOpenBooking }: HeroProps) {
  const { status, rawStatus, isStatusKnown } = useCafeOperations();
  const googleRating = useGoogleRating();

  return (
    <section
      id="hero"
      aria-label="Welcome to The Spicy Garden Cafe & Bistro"
      className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden bg-gradient-to-b from-chili-50/40 via-white to-white dark:from-gray-950 dark:via-gray-950 dark:to-surface-dark"
    >
      {/* Background Decorative Blur Orbs */}
      <div className="absolute top-12 left-1/4 w-72 h-72 bg-chili-500/10 dark:bg-chili-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-garden-500/10 dark:bg-garden-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          
          {/* Left Hero Content */}
          <div className="lg:col-span-7 text-center lg:text-left space-y-6">
            
            {/* Top Badges */}
            <div className="inline-flex flex-wrap items-center justify-center lg:justify-start gap-2">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-chili-100 dark:bg-chili-950/80 text-chili-700 dark:text-chili-300 border border-chili-200 dark:border-chili-800 shadow-sm">
                <Flame className="w-3.5 h-3.5 text-chili-600 animate-pulse" />
                <span>{RESTAURANT_DATA.contact.address.locality}'s Favorite Cafe & Bistro</span>
              </span>
              
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium border bg-white/80 dark:bg-gray-900/80 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 backdrop-blur-sm">
                <span className={`w-2 h-2 rounded-full ${!isStatusKnown ? 'bg-gray-400' : status.isOpen ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="font-semibold">{status.statusText}</span>
                {status.nextStatusText && <span className="text-gray-400">• {status.nextStatusText}</span>}
              </div>
            </div>

            {/* Main Headline */}
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-[1.15]">
              Flavors That Ignite,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-chili-600 via-rose-500 to-amber-500">
                Moments That Delight.
              </span>
            </h1>

            {/* Verified Motto & Description */}
            <p className="font-sans text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              <strong className="text-gray-900 dark:text-white font-medium">{RESTAURANT_DATA.brand.motto}.</strong> From sizzling loaded pizzas and cheesy pasta to authentic Tibetan momos with hot soup, enjoy exceptional tastes in our cozy air-conditioned mural dining room.
            </p>

            {/* Action CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
              <a
                href="#menu"
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-bold text-sm text-white bg-chili-600 hover:bg-chili-700 active:scale-95 transition-all shadow-lg shadow-chili-600/30 flex items-center justify-center space-x-2"
              >
                <span>Explore Full Menu</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <button
                onClick={() => onOpenBooking("Birthday / Party Celebration")}
                type="button"
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 transition-all flex items-center justify-center space-x-2 shadow-sm"
              >
                <Calendar className="w-4 h-4 text-chili-600 dark:text-chili-400" />
                <span>Book Celebration</span>
              </button>

              <a
                href={RESTAURANT_DATA.contact.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-5 py-3.5 rounded-xl font-bold text-sm text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/80 transition-all flex items-center justify-center space-x-2"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>WhatsApp Order</span>
              </a>
            </div>

            {/* Verified Quick Proof Badges */}
            <div className="pt-4 border-t border-gray-200/80 dark:border-gray-800/80 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-gray-600 dark:text-gray-400">
              <a
                href={RESTAURANT_DATA.contact.geo.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1.5 hover:opacity-85 transition-opacity group cursor-pointer"
                title="View verified Google reviews directly on Google Maps"
              >
                <div className="flex text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>
                <span className="font-bold text-gray-900 dark:text-white group-hover:text-chili-600 transition-colors">
                  {googleRating.rating} / 5
                </span>
                <span className="flex items-center space-x-1">
                  <span>({googleRating.totalReviews})</span>
                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                    <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                    </svg>
                    <span>Google</span>
                  </span>
                </span>
              </a>

              <div className="flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-chili-500" />
                <span className="font-semibold text-gray-800 dark:text-gray-200">{RESTAURANT_DATA.stats.dishesServed}</span>
              </div>

              {rawStatus?.operations?.shortHoursDisplay && (
                <div className="flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-garden-600 dark:text-garden-400" />
                  <span>{rawStatus.operations.shortHoursDisplay}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Hero Image Card (LCP Candidate with fetchpriority="high") */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              
              {/* Image Frame with Glow */}
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white dark:border-gray-800 shadow-chili-950/20 group">
                <div className="aspect-[4/3] sm:aspect-[1/1] relative">
                  <Image
                    src={RESTAURANT_DATA.assets.heroPizza}
                    alt={`Signature Gourmet Pizza at ${RESTAURANT_DATA.brand.name} ${RESTAURANT_DATA.contact.address.locality}`}
                    fill
                    // Modern Web Guidance: fetchpriority="high" on LCP candidate, no loading="lazy"
                    priority
                    fetchPriority="high"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 40vw"
                    placeholder="blur"
                    blurDataURL={RESTAURANT_DATA.assetPlaceholders.heroPizza}
                    decoding="async"
                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  
                  {/* Subtle Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />

                  {/* Overlaid Badge */}
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
                    <div>
                      <p className="text-xs uppercase font-bold tracking-widest text-amber-300">
                        {RESTAURANT_DATA.heroSpotlight.tag}
                      </p>
                      <p className="text-lg sm:text-xl font-serif font-bold">
                        {RESTAURANT_DATA.heroSpotlight.title}
                      </p>
                    </div>
                    <div className="text-right bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/30">
                      <p className="text-[10px] text-gray-200 uppercase font-medium">{RESTAURANT_DATA.heroSpotlight.priceLabel}</p>
                      <p className="text-lg font-bold text-amber-300 font-sans">{RESTAURANT_DATA.heroSpotlight.price}</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
