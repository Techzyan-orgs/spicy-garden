'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface AdminContentLoaderProps {
  activePath?: string;
}

const SECTION_TITLES: Record<string, string> = {
  '/admin': 'Overview',
  '/admin/orders': 'Pending Orders',
  '/admin/analytics': 'Analytics & Reports',
  '/admin/menu': 'Menu Items',
  '/admin/categories': 'Categories',
  '/admin/operations': 'Cafe Timings & Status',
  '/admin/whatsapp': 'WhatsApp Marketing',
  '/admin/marketing': 'WhatsApp Marketing',
};

export default function AdminContentLoader({ activePath }: AdminContentLoaderProps) {
  const sectionTitle = (activePath && SECTION_TITLES[activePath]) || 'Section';

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200 relative pb-12">
      {/* Top Animated Accent Glow Line */}
      <div className="absolute -top-4 sm:-top-6 lg:-top-8 left-0 right-0 h-1 overflow-hidden pointer-events-none">
        <div className="w-full h-full bg-gradient-to-r from-transparent via-chili-500 to-transparent animate-pulse" />
      </div>

      {/* Header Skeleton Bar with Dynamic Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-100 dark:border-gray-800/80">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chili-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-chili-600" />
            </span>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Loading {sectionTitle}
              <Loader2 className="w-4 h-4 animate-spin text-chili-600 dark:text-chili-400 inline" />
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Fetching latest records and live data...
          </p>
        </div>

        {/* Right side dummy action button skeleton */}
        <div className="flex items-center space-x-3">
          <div className="h-9 w-28 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
          <div className="h-9 w-24 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
        </div>
      </div>

      {/* Metric Cards Skeleton Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/90 shadow-sm space-y-3 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 bg-gray-200 dark:bg-gray-800 rounded-md" />
              <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-gray-800/70" />
            </div>
            <div className="h-7 w-20 bg-gray-200 dark:bg-gray-800 rounded-lg" />
            <div className="h-3 w-32 bg-gray-100 dark:bg-gray-800/60 rounded-md" />
          </div>
        ))}
      </div>

      {/* Main Content Card Skeleton */}
      <div className="p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/90 shadow-sm space-y-5 animate-pulse">
        {/* Table / List Controls Skeleton */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="h-9 w-full sm:w-64 bg-gray-100 dark:bg-gray-800 rounded-xl" />
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <div className="h-8 w-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
            <div className="h-8 w-20 bg-gray-100 dark:bg-gray-800 rounded-lg" />
            <div className="h-8 w-24 bg-gray-100 dark:bg-gray-800 rounded-lg" />
          </div>
        </div>

        {/* Placeholder Rows / Blocks */}
        <div className="space-y-3.5 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between p-4 rounded-2xl bg-gray-50/80 dark:bg-gray-800/40 border border-gray-100/80 dark:border-gray-800/60"
            >
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700/80 flex-shrink-0" />
                <div className="space-y-2">
                  <div
                    className="h-3.5 bg-gray-200 dark:bg-gray-700/80 rounded"
                    style={{ width: `${140 + (row * 30) % 100}px` }}
                  />
                  <div className="h-2.5 w-24 bg-gray-200/70 dark:bg-gray-700/50 rounded" />
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700/70 rounded-full" />
                <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700/70 rounded-xl hidden sm:block" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
