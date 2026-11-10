'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { LiveOperationsStatus, ClosureNotice } from '@/types/operations';

/**
 * Café hours / open status. The database (via /api/operations) is the only source:
 * there are no built-in hours. Until live status is known, `isStatusKnown` is false,
 * `isOpen` is false (ordering stays disabled) and neutral "checking" texts are shown.
 */
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
  /** True once live status has been loaded from the server at least once. */
  isStatusKnown: boolean;
  isLoading: boolean;
  /** Set when the latest load failed and no live status is available. */
  error: string | null;
  refetchOperations: () => Promise<void>;
}

const NEUTRAL_BADGE = 'bg-gray-500/15 text-gray-400 border-gray-500/30';
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function istDay(): { dayOfWeek: number; currentDayName: string } {
  const now = new Date();
  const ist = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 5.5 * 3600000);
  const dayOfWeek = ist.getDay();
  return { dayOfWeek, currentDayName: DAY_NAMES[dayOfWeek] };
}

function unknownStatus(error: string | null) {
  return {
    isOpen: false,
    statusText: error ? 'Hours unavailable' : 'Checking hours…',
    nextStatusText: error ? 'Please call us to order' : '',
    badgeColorClass: NEUTRAL_BADGE,
    todayHoursDisplay: '',
    ...istDay(),
  };
}

const CafeOperationsContext = createContext<CafeOperationsContextValue | undefined>(undefined);

const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 60_000;

export function CafeOperationsProvider({ children }: { children: React.ReactNode }) {
  const [rawStatus, setRawStatus] = useState<LiveOperationsStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(RETRY_MIN_MS);

  const fetchOperations = useCallback(async (force = false) => {
    const now = Date.now();
    // Throttle duplicate calls within 5 seconds unless explicitly forced
    if (!force && now - lastFetchTimeRef.current < 5000) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    let ok = false;
    try {
      const res = await fetch('/api/operations', { cache: 'no-store' });
      if (res.ok) {
        const data: LiveOperationsStatus = await res.json();
        if (data && typeof data.statusText === 'string') {
          setRawStatus(data);
          setError(null);
          lastFetchTimeRef.current = Date.now();
          retryDelayRef.current = RETRY_MIN_MS;
          ok = true;
        }
      }
      if (!ok) setError('Opening hours are temporarily unavailable.');
    } catch {
      setError('Opening hours are temporarily unavailable.');
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
      if (!ok) {
        // Retry with exponential backoff until the server answers.
        const delay = retryDelayRef.current;
        retryDelayRef.current = Math.min(delay * 2, RETRY_MAX_MS);
        retryTimerRef.current = setTimeout(() => fetchOperations(true), delay);
      }
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
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (channel) channel.close();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [fetchOperations]);

  // Once known, keep showing the last live status even if a later refresh fails.
  const isStatusKnown = rawStatus !== null;
  const status = rawStatus
    ? {
        isOpen: rawStatus.isOpen,
        statusText: rawStatus.statusText,
        nextStatusText: rawStatus.nextStatusText,
        badgeColorClass: rawStatus.badgeColorClass,
        todayHoursDisplay: rawStatus.todayHoursDisplay,
        currentDayName: rawStatus.currentDayName,
        dayOfWeek: rawStatus.dayOfWeek,
      }
    : unknownStatus(isLoading ? null : error);

  const isNoticeActive = Boolean(rawStatus?.isNoticeActive && rawStatus?.activeNotice?.enabled);
  const activeNotice = rawStatus?.activeNotice ?? null;

  const value: CafeOperationsContextValue = {
    ...status,
    isNoticeActive,
    activeNotice,
    rawStatus,
    status,
    isStatusKnown,
    isLoading,
    error: isStatusKnown ? null : error,
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
    const status = unknownStatus(null);
    return {
      ...status,
      isNoticeActive: false,
      activeNotice: null,
      rawStatus: null,
      status,
      isStatusKnown: false,
      isLoading: true,
      error: null,
      refetchOperations: async () => {},
    };
  }
  return context;
}
