'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { LiveOperationsStatus, ClosureNotice } from '@/types/operations';
import { getRestaurantCurrentStatus } from '@/data/restaurantData';

interface CafeOperationsContextValue {
  isOpen: boolean;
  statusText: string;
  nextStatusText: string;
  badgeColorClass: string;
  todayHoursDisplay: string;
  currentDayName: string;
  dayOfWeek: number;
  isNoticeActive: boolean;
  activeNotice: ClosureNotice | null;
  rawStatus: LiveOperationsStatus | null;
  status: {
    isOpen: boolean;
    statusText: string;
    nextStatusText: string;
    badgeColorClass: string;
    todayHoursDisplay: string;
    currentDayName: string;
    dayOfWeek: number;
  };
  isLoading: boolean;
  refetchOperations: () => Promise<void>;
}

const CafeOperationsContext = createContext<CafeOperationsContextValue | undefined>(undefined);

export function CafeOperationsProvider({ children }: { children: React.ReactNode }) {
  const defaultStatus = getRestaurantCurrentStatus();
  const [rawStatus, setRawStatus] = useState<LiveOperationsStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);

  const fetchOperations = useCallback(async (force = false) => {
    const now = Date.now();
    // Throttle duplicate calls within 5 seconds unless explicitly forced
    if (!force && now - lastFetchTimeRef.current < 5000) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const res = await fetch('/api/operations');
      if (res.ok) {
        const data: LiveOperationsStatus = await res.json();
        if (data && data.statusText) {
          setRawStatus(data);
          lastFetchTimeRef.current = Date.now();
        }
      }
    } catch (e) {
      // Quiet failover to preserve current state
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOperations(true);

    // 1. Listen for cross-tab updates from Admin Portal via BroadcastChannel
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        channel = new BroadcastChannel('sg_operations_channel');
        channel.onmessage = () => {
          fetchOperations(true);
        };
      } catch (e) {}
    }

    // 2. Visibility-aware revalidation: fetch immediately when user returns to tab after absence
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastFetchTimeRef.current >= 60000) {
          fetchOperations(true);
        }
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    // 3. Relaxed background interval (120 seconds), paused when tab is inactive/hidden
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        fetchOperations();
      }
    }, 120000);

    return () => {
      clearInterval(interval);
      if (channel) channel.close();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [fetchOperations]);

  const isOpen = rawStatus?.isOpen ?? defaultStatus.isOpen;
  const statusText = rawStatus?.statusText ?? defaultStatus.statusText;
  const nextStatusText = rawStatus?.nextStatusText ?? defaultStatus.nextStatusText;
  const badgeColorClass = rawStatus?.badgeColorClass ?? defaultStatus.badgeColorClass;
  const todayHoursDisplay = rawStatus?.todayHoursDisplay ?? defaultStatus.todayHoursDisplay;
  const currentDayName = rawStatus?.currentDayName ?? defaultStatus.currentDayName;
  const dayOfWeek = rawStatus?.dayOfWeek ?? defaultStatus.dayOfWeek;
  const isNoticeActive = Boolean(rawStatus?.isNoticeActive && rawStatus?.activeNotice?.enabled);
  const activeNotice = rawStatus?.activeNotice ?? null;

  const value: CafeOperationsContextValue = {
    isOpen,
    statusText,
    nextStatusText,
    badgeColorClass,
    todayHoursDisplay,
    currentDayName,
    dayOfWeek,
    isNoticeActive,
    activeNotice,
    rawStatus,
    status: {
      isOpen,
      statusText,
      nextStatusText,
      badgeColorClass,
      todayHoursDisplay,
      currentDayName,
      dayOfWeek,
    },
    isLoading,
    refetchOperations: () => fetchOperations(true),
  };

  return (
    <CafeOperationsContext.Provider value={value}>
      {children}
    </CafeOperationsContext.Provider>
  );
}

export function useCafeOperations(): CafeOperationsContextValue {
  const context = useContext(CafeOperationsContext);
  if (!context) {
    const defaultStatus = getRestaurantCurrentStatus();
    return {
      isOpen: defaultStatus.isOpen,
      statusText: defaultStatus.statusText,
      nextStatusText: defaultStatus.nextStatusText,
      badgeColorClass: defaultStatus.badgeColorClass,
      todayHoursDisplay: defaultStatus.todayHoursDisplay,
      currentDayName: defaultStatus.currentDayName,
      dayOfWeek: defaultStatus.dayOfWeek,
      isNoticeActive: false,
      activeNotice: null,
      rawStatus: null,
      status: defaultStatus,
      isLoading: false,
      refetchOperations: async () => {},
    };
  }
  return context;
}
