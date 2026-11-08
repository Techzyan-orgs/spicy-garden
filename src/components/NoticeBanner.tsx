'use client';

import React, { useState } from 'react';
import { AlertCircle, Calendar, X, Sparkles } from 'lucide-react';
import { useCafeOperations } from '@/context/CafeOperationsContext';

export default function NoticeBanner() {
  const { rawStatus: status, isNoticeActive, activeNotice } = useCafeOperations();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!status || !isNoticeActive || !activeNotice || isDismissed) {
    return null;
  }

  return (
    <aside
      aria-label="Important Announcement"
      className="bg-gradient-to-r from-amber-600 via-rose-600 to-chili-700 text-white shadow-md w-full border-b border-white/20 transition-all duration-300"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center space-x-2.5 sm:space-x-3 flex-1 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0 animate-pulse">
            <AlertCircle className="w-4 h-4 text-white" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="font-extrabold uppercase tracking-wider text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-white text-rose-700 font-sans shadow-sm">
                {activeNotice.reason || 'Notice'}
              </span>
              <span className="font-bold text-white tracking-wide">
                {activeNotice.title}
              </span>
              {(activeNotice.startDate || activeNotice.endDate) && (
                <span className="inline-flex items-center space-x-1 text-[11px] sm:text-xs text-white/90 bg-black/20 px-2 py-0.5 rounded-md">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {activeNotice.startDate && activeNotice.endDate
                      ? `${activeNotice.startDate} to ${activeNotice.endDate}`
                      : activeNotice.startDate
                      ? `From ${activeNotice.startDate}`
                      : `Until ${activeNotice.endDate}`}
                  </span>
                </span>
              )}
            </div>

            {activeNotice.message && (
              <p className="text-xs text-white/95 mt-0.5 leading-snug line-clamp-2">
                {activeNotice.message}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
          title="Dismiss notice banner"
          aria-label="Dismiss notice"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
