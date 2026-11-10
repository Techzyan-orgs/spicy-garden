'use client';

import { useState, useEffect, useCallback } from 'react';
import { MenuItem, MenuCategory } from '@/data/restaurantData';

/**
 * Live menu from /api/menu (Firebase is the only source). There is no built-in
 * fallback menu: until the first successful load `items`/`categories` are empty,
 * `isLoading` is true, and on failure `error` is set and loading is retried with
 * exponential backoff.
 */
export interface ExtendedMenuItem extends MenuItem {
  isAvailable?: boolean;
  image_url?: string;
}

interface MenuCache {
  categories: MenuCategory[];
  items: ExtendedMenuItem[];
  timestamp: number;
}

const MENU_UNAVAILABLE = 'Our menu is temporarily unavailable.';
const RETRY_MIN_MS = 3_000;
const RETRY_MAX_MS = 60_000;

let globalMenuCache: MenuCache | null = null;
let globalMenuError: string | null = null;
let inFlightMenuPromise: Promise<MenuCache | null> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = RETRY_MIN_MS;

type Listener = (state: { cache: MenuCache | null; error: string | null }) => void;
const menuListeners = new Set<Listener>();

function notify() {
  menuListeners.forEach((l) => l({ cache: globalMenuCache, error: globalMenuError }));
}

function scheduleRetry() {
  if (retryTimer || menuListeners.size === 0) return;
  const delay = retryDelay;
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (menuListeners.size > 0) void getOrFetchMenu(true);
  }, delay);
}

async function getOrFetchMenu(force = false): Promise<MenuCache | null> {
  if (!force && globalMenuCache) return globalMenuCache;
  // Deduplicate any concurrent in-flight fetch across all callers and events
  if (inFlightMenuPromise) return inFlightMenuPromise;

  inFlightMenuPromise = (async () => {
    try {
      const res = await fetch('/api/menu', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Menu request failed (${res.status})`);
      const data = await res.json();
      if (!Array.isArray(data?.categories) || !Array.isArray(data?.items)) {
        throw new Error('Malformed menu response');
      }
      globalMenuCache = { categories: data.categories, items: data.items, timestamp: Date.now() };
      globalMenuError = null;
      retryDelay = RETRY_MIN_MS;
    } catch (err) {
      console.warn('[useMenuData] Menu load failed:', err);
      // Keep showing the last live menu if we have one; only surface an error when we have nothing.
      if (!globalMenuCache) globalMenuError = MENU_UNAVAILABLE;
      scheduleRetry();
    } finally {
      inFlightMenuPromise = null;
    }
    notify();
    return globalMenuCache;
  })();

  return inFlightMenuPromise;
}

export function useMenuData() {
  const [categories, setCategories] = useState<MenuCategory[]>(globalMenuCache?.categories ?? []);
  const [items, setItems] = useState<ExtendedMenuItem[]>(globalMenuCache?.items ?? []);
  const [isLoading, setIsLoading] = useState<boolean>(!globalMenuCache && !globalMenuError);
  const [error, setError] = useState<string | null>(globalMenuCache ? null : globalMenuError);

  const fetchMenu = useCallback(async (force = false) => {
    if (!globalMenuCache) {
      setIsLoading(true);
      setError(null);
    }
    await getOrFetchMenu(force);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const handleUpdate: Listener = ({ cache, error: err }) => {
      if (!isMounted) return;
      if (cache) {
        setCategories(cache.categories);
        setItems(cache.items);
      }
      setError(cache ? null : err);
      setIsLoading(false);
    };

    menuListeners.add(handleUpdate);

    if (globalMenuCache) {
      handleUpdate({ cache: globalMenuCache, error: null });
    } else {
      // Deduplicated initial fetch across all concurrently mounting components
      void getOrFetchMenu(false);
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'sg_menu_last_update') void getOrFetchMenu(true);
    };
    const handleLocalMenuUpdate = () => {
      void getOrFetchMenu(true);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('sg_menu_updated', handleLocalMenuUpdate);

    return () => {
      isMounted = false;
      menuListeners.delete(handleUpdate);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('sg_menu_updated', handleLocalMenuUpdate);
    };
  }, []);

  return {
    categories,
    items,
    isLoading,
    error,
    /** True when a live menu has been loaded. */
    isLive: items.length > 0 || categories.length > 0,
    refetch: () => fetchMenu(true),
  };
}
