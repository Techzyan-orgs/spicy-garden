'use client';

import { useState, useEffect, useCallback } from 'react';
import { RESTAURANT_DATA, MenuItem, MenuCategory } from '@/data/restaurantData';

export interface ExtendedMenuItem extends MenuItem {
  isAvailable?: boolean;
  image_url?: string;
}

interface MenuCache {
  categories: MenuCategory[];
  items: ExtendedMenuItem[];
  isLive: boolean;
  timestamp: number;
}

let globalMenuCache: MenuCache | null = null;
let inFlightMenuPromise: Promise<MenuCache | null> | null = null;
const menuListeners = new Set<(cache: MenuCache) => void>();

async function getOrFetchMenu(force = false): Promise<MenuCache | null> {
  if (!force && globalMenuCache) {
    return globalMenuCache;
  }
  // Deduplicate any concurrent in-flight fetch across all callers and events
  if (inFlightMenuPromise) {
    return inFlightMenuPromise;
  }

  inFlightMenuPromise = (async () => {
    try {
      const res = await fetch('/api/menu', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch menu');
      const data = await res.json();

      if (data.categories && data.items) {
        const newCache: MenuCache = {
          categories: data.categories,
          items: data.items,
          isLive: true,
          timestamp: Date.now(),
        };
        globalMenuCache = newCache;
        menuListeners.forEach((listener) => listener(newCache));
        return newCache;
      }
    } catch (err) {
      console.warn('[useMenuData] Using cached or default menu data:', err);
      return globalMenuCache;
    } finally {
      inFlightMenuPromise = null;
    }
    return globalMenuCache;
  })();

  return inFlightMenuPromise;
}

export function useMenuData() {
  const [categories, setCategories] = useState<MenuCategory[]>(
    globalMenuCache ? globalMenuCache.categories : RESTAURANT_DATA.menu.categories
  );
  const [items, setItems] = useState<ExtendedMenuItem[]>(
    globalMenuCache
      ? globalMenuCache.items
      : RESTAURANT_DATA.menu.items.map((i) => ({ ...i, isAvailable: true }))
  );
  const [isLoading, setIsLoading] = useState<boolean>(!globalMenuCache);
  const [isLive, setIsLive] = useState<boolean>(true);

  const fetchMenu = useCallback(async (force = false) => {
    setIsLoading(!globalMenuCache);
    const result = await getOrFetchMenu(force);
    if (result) {
      setCategories(result.categories);
      setItems(result.items);
      setIsLive(true);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const handleCacheUpdate = (cache: MenuCache) => {
      if (isMounted) {
        setCategories(cache.categories);
        setItems(cache.items);
        setIsLive(true);
        setIsLoading(false);
      }
    };

    menuListeners.add(handleCacheUpdate);

    // If cache already exists, do not fire a network request on mount
    if (globalMenuCache) {
      setCategories(globalMenuCache.categories);
      setItems(globalMenuCache.items);
      setIsLoading(false);
    } else {
      // Deduplicated initial fetch across all concurrent mounting components
      getOrFetchMenu(false)
        .then((cache) => {
          if (isMounted && cache) {
            setCategories(cache.categories);
            setItems(cache.items);
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        });
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'sg_menu_last_update') {
        getOrFetchMenu(true);
      }
    };
    const handleLocalMenuUpdate = () => {
      getOrFetchMenu(true);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('sg_menu_updated', handleLocalMenuUpdate);

    return () => {
      isMounted = false;
      menuListeners.delete(handleCacheUpdate);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('sg_menu_updated', handleLocalMenuUpdate);
    };
  }, []);

  return {
    categories,
    items,
    isLoading,
    isLive,
    refetch: () => fetchMenu(true),
  };
}
