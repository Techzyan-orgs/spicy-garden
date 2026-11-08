"use client";

import React, { useState, useEffect } from "react";
import { RESTAURANT_DATA, formatRelativeTime } from "@/data/restaurantData";
import { useGoogleRating } from "@/hooks/useGoogleRating";
import { Star, MessageSquareQuote, ThumbsUp, Heart, ExternalLink } from "lucide-react";

export default function ReviewsSection() {
  const googleRating = useGoogleRating();

  const [relativeDates, setRelativeDates] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    RESTAURANT_DATA.reviews.forEach((rev) => {
      initial[rev.id] = rev.date || 'Recently';
    });
    return initial;
  });

  useEffect(() => {
    // Dynamically calculate elapsed relative time for each review on client
    const updated: Record<string, string> = {};
    RESTAURANT_DATA.reviews.forEach((rev) => {
      updated[rev.id] = rev.isoDate ? formatRelativeTime(rev.isoDate) : (rev.date || 'Recently');
    });
    setRelativeDates(updated);
  }, []);
  return (
    <section id="reviews" className="py-20 bg-white dark:bg-gray-950 scroll-mt-20 border-t border-gray-200/60 dark:border-gray-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/40 mb-2">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Google Verified Reviews</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
              Loved by {RESTAURANT_DATA.contact.address.locality} & {RESTAURANT_DATA.contact.address.city} Foodies
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 max-w-xl">
              Here is what our guests have to say about our food quality, hospitality, and celebration arrangements.
            </p>
          </div>

          <a
            href={RESTAURANT_DATA.contact.geo.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 md:mt-0 flex items-center space-x-3 p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-chili-500 transition-colors group cursor-pointer"
            title="Read verified patron reviews directly on Google Maps"
          >
            <div className="text-center">
              <span className="text-3xl font-extrabold font-serif text-gray-900 dark:text-white group-hover:text-chili-600 transition-colors">
                {googleRating.rating}
              </span>
              <div className="flex text-amber-400 mt-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                ))}
              </div>
            </div>
            <div className="border-l border-gray-200 dark:border-gray-700 pl-3">
              <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-chili-600 transition-colors flex items-center space-x-1">
                <span>{googleRating.totalReviews} Google Reviews</span>
                <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-chili-500" />
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center space-x-1 mt-0.5">
                <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>Google Business Profile</span>
              </p>
            </div>
          </a>
        </div>

        {/* Reviews Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {RESTAURANT_DATA.reviews.map((rev) => (
            <div
              key={rev.id}
              className="p-6 rounded-3xl bg-gray-50/80 dark:bg-gray-900/80 border border-gray-200/80 dark:border-gray-800 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex text-amber-400">
                    {[...Array(rev.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                  <span className="text-[11px] text-gray-400">{relativeDates[rev.id] || rev.date}</span>
                </div>

                <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed mb-4">
                  "{rev.comment}"
                </p>
              </div>

              <div className="pt-3 border-t border-gray-200/60 dark:border-gray-800">
                <p className="text-xs font-bold text-gray-900 dark:text-white">
                  {rev.name}
                </p>
                {rev.favoriteDish && (
                  <p className="text-[11px] text-chili-600 dark:text-chili-400 font-medium mt-0.5">
                    Favorite: {rev.favoriteDish}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
