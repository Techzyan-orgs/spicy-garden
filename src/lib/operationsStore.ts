import fs from 'fs';
import path from 'path';
import {
  OperationsData,
  LiveOperationsStatus,
  ManualStatusOverride,
  ClosureNotice,
} from '@/types/operations';
import { getFirebaseData, setFirebaseData, isFirebaseConfigured } from './firebaseRtdb';

const OPERATIONS_FILE_PATH = path.join(process.cwd(), 'src', 'data', 'operations.json');

// In-memory cache for fast lookups
let cachedOperationsData: OperationsData | null = null;
let lastReadTime = 0;

export function getDefaultOperationsData(): OperationsData {
  return {
    manualStatus: 'auto',
    manualStatusNote: '',
    updatedAt: new Date().toISOString(),
    daysDisplay: 'Open All 7 Days',
    hoursDisplay: 'Mon–Thu, Sat–Sun: 2:00 PM – 11:30 PM | Fri: 1:00 PM – 11:00 PM',
    shortHoursDisplay: 'Mon–Thu, Sat–Sun: 2–11:30 PM • Fri: 1–11 PM',
    kitchenClosesDisplay: 'Last Kitchen Order: 30 minutes before closing',
    regularOpenHour24: 14.0,
    regularCloseHour24: 23.5,
    fridayOpenHour24: 13.0,
    fridayCloseHour24: 23.0,
    schedule: [
      { day: 'Monday', open: '2:00 PM', close: '11:30 PM', isOpen: true },
      { day: 'Tuesday', open: '2:00 PM', close: '11:30 PM', isOpen: true },
      { day: 'Wednesday', open: '2:00 PM', close: '11:30 PM', isOpen: true },
      { day: 'Thursday', open: '2:00 PM', close: '11:30 PM', isOpen: true },
      { day: 'Friday', open: '1:00 PM', close: '11:00 PM', isOpen: true },
      { day: 'Saturday', open: '2:00 PM', close: '11:30 PM', isOpen: true },
      { day: 'Sunday', open: '2:00 PM', close: '11:30 PM', isOpen: true },
    ],
    closureNotice: {
      enabled: false,
      title: 'Special Notice',
      message: '',
      startDate: '',
      endDate: '',
      reason: 'Holiday',
    },
  };
}

function readLocalFallback(): OperationsData {
  try {
    if (fs.existsSync(OPERATIONS_FILE_PATH)) {
      const content = fs.readFileSync(OPERATIONS_FILE_PATH, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        return {
          ...getDefaultOperationsData(),
          ...parsed,
          closureNotice: {
            ...getDefaultOperationsData().closureNotice,
            ...(parsed.closureNotice || {}),
          },
        };
      }
    }
  } catch (err) {
    console.warn('[OperationsStore] Error reading local operations file:', err);
  }
  return getDefaultOperationsData();
}

/**
 * Reads operations data from Firebase Realtime Database (/operations) or fallback
 */
export async function readOperationsFromStore(forceFresh = false): Promise<OperationsData> {
  const now = Date.now();
  if (!forceFresh && cachedOperationsData && now - lastReadTime < 60000) {
    return cachedOperationsData;
  }

  // 1. Fetch from Firebase Realtime Database
  if (isFirebaseConfigured()) {
    try {
      const remote = await getFirebaseData<OperationsData>('operations');
      if (remote && remote.schedule) {
        const merged: OperationsData = {
          ...getDefaultOperationsData(),
          ...remote,
          closureNotice: {
            ...getDefaultOperationsData().closureNotice,
            ...(remote.closureNotice || {}),
          },
        };
        cachedOperationsData = merged;
        lastReadTime = now;
        return merged;
      }
    } catch (fbErr) {
      console.warn('[OperationsStore] Firebase fetch warning:', fbErr);
    }
  }

  // 2. Fallback to local file or defaults
  const fallback = readLocalFallback();
  cachedOperationsData = fallback;
  lastReadTime = now;
  return fallback;
}

/**
 * Writes updated operations data to Firebase Realtime Database (/operations) and memory
 */
export async function writeOperationsToStore(data: OperationsData): Promise<void> {
  cachedOperationsData = data;
  lastReadTime = Date.now();

  // 1. Write to Firebase Realtime Database
  if (isFirebaseConfigured()) {
    const success = await setFirebaseData('operations', data);
    if (!success) {
      console.warn('[OperationsStore] Failed to write operations to Firebase');
    }
  }

  // 2. Best-effort local file update (dev environment only; skipped on serverless production)
  if (process.env.NODE_ENV !== 'production') {
    try {
      const dir = path.dirname(OPERATIONS_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(OPERATIONS_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (fsErr) {
      // Expected on read-only environments
    }
  }
}

export function parseTimeStringTo24(timeStr?: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();

  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return hours + minutes / 60;
}

/**
 * Computes live operational status based on current IST time, schedule, manual override, and closure notices.
 */
export function getLiveOperationalStatus(overrideData?: OperationsData): LiveOperationsStatus {
  const data = overrideData || cachedOperationsData || readLocalFallback();

  // Robust time & date in IST (Asia/Kolkata)
  const now = new Date();

  // YYYY-MM-DD in IST
  const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const currentDateStr = istDateFormatter.format(now);

  // Hours in IST
  const istHourFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = istHourFormatter.formatToParts(now);
  const hourPart = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minutePart = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const currentHours = hourPart + minutePart / 60;

  // Day of week in IST
  const istDayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
  });
  const currentDayName = istDayFormatter.format(now);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = dayNames.indexOf(currentDayName) >= 0 ? dayNames.indexOf(currentDayName) : now.getDay();

  // 1. Evaluate Closure Notice & Advance Announcement
  let isNoticeActive = false;
  let isWithinClosurePeriod = false;
  const notice = data.closureNotice;

  if (notice && notice.enabled) {
    const isExpired = Boolean(notice.endDate && currentDateStr > notice.endDate);
    if (!isExpired) {
      isNoticeActive = true;
      const isAfterStart = !notice.startDate || currentDateStr >= notice.startDate;
      const isBeforeEnd = !notice.endDate || currentDateStr <= notice.endDate;
      isWithinClosurePeriod = isAfterStart && isBeforeEnd;
    }
  }

  // If currently within closure period and manualStatus is not force_open, cafe is closed
  if (isWithinClosurePeriod && data.manualStatus !== 'force_open') {
    return {
      isOpen: false,
      statusText: notice.title || 'Temporarily Closed',
      nextStatusText: notice.message || 'Notice in effect',
      badgeColorClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      todayHoursDisplay: 'Closed for Notice',
      currentDayName,
      dayOfWeek,
      manualStatus: data.manualStatus,
      isNoticeActive: true,
      activeNotice: notice,
      operations: data,
    };
  }

  // 2. Check Manual Override: Force Closed
  if (data.manualStatus === 'force_closed') {
    return {
      isOpen: false,
      statusText: data.manualStatusNote?.trim() || 'Temporarily Closed',
      nextStatusText: 'Closed manually by owner',
      badgeColorClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      todayHoursDisplay: 'Currently Closed',
      currentDayName,
      dayOfWeek,
      manualStatus: 'force_closed',
      isNoticeActive,
      activeNotice: isNoticeActive ? notice : null,
      operations: data,
    };
  }

  // 3. Check Manual Override: Force Open
  if (data.manualStatus === 'force_open') {
    return {
      isOpen: true,
      statusText: data.manualStatusNote?.trim() || 'Open Now (Special)',
      nextStatusText: 'Serving Guests',
      badgeColorClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      todayHoursDisplay: 'Open for Orders',
      currentDayName,
      dayOfWeek,
      manualStatus: 'force_open',
      isNoticeActive,
      activeNotice: isNoticeActive ? notice : null,
      operations: data,
    };
  }

  // 4. Automatic Schedule Lookup
  const todaySchedule = data.schedule.find(
    (s) => s.day.toLowerCase() === currentDayName.toLowerCase()
  );

  const isTodayOpenConfigured = todaySchedule ? todaySchedule.isOpen : true;

  // Resolve opening and closing hour dynamically from today's active schedule
  const isFriday = dayOfWeek === 5;
  const defaultOpen = isFriday ? data.fridayOpenHour24 : data.regularOpenHour24;
  const defaultClose = isFriday ? data.fridayCloseHour24 : data.regularCloseHour24;

  const openTime = parseTimeStringTo24(todaySchedule?.open) ?? defaultOpen;
  const closeTime = parseTimeStringTo24(todaySchedule?.close) ?? defaultClose;
  const openTimeText = todaySchedule?.open || (isFriday ? '1:00 PM' : '2:00 PM');
  const closeTimeText = todaySchedule?.close || (isFriday ? '11:00 PM' : '11:30 PM');
  const todayHoursDisplay = `${openTimeText} – ${closeTimeText}`;

  if (!isTodayOpenConfigured) {
    return {
      isOpen: false,
      statusText: 'Closed Today',
      nextStatusText: 'Reopens tomorrow',
      badgeColorClass: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      todayHoursDisplay: 'Closed Today',
      currentDayName,
      dayOfWeek,
      manualStatus: 'auto',
      isNoticeActive,
      activeNotice: isNoticeActive ? notice : null,
      operations: data,
    };
  }

  // Support operating hours crossing midnight (e.g., 18:00 to 01:00)
  // When closeTime === openTime, store is closed (prevents open 24/7 tautology)
  const isWithinHours =
    closeTime === openTime
      ? false
      : closeTime > openTime
      ? currentHours >= openTime && currentHours < closeTime
      : currentHours >= openTime || currentHours < closeTime;

  if (isWithinHours) {
    let isClosingSoon = false;
    if (closeTime > openTime) {
      isClosingSoon = currentHours >= closeTime - 0.75; // last 45 minutes
    } else {
      const effectiveClose = closeTime + 24;
      const effectiveCurrent = currentHours < openTime ? currentHours + 24 : currentHours;
      isClosingSoon = effectiveCurrent >= effectiveClose - 0.75;
    }

    return {
      isOpen: true,
      statusText: isClosingSoon ? 'Open Now (Kitchen Closes Soon)' : 'Open Now',
      nextStatusText: `Closes at ${closeTimeText}`,
      badgeColorClass: isClosingSoon
        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      todayHoursDisplay,
      currentDayName,
      dayOfWeek,
      manualStatus: 'auto',
      isNoticeActive,
      activeNotice: isNoticeActive ? notice : null,
      operations: data,
    };
  }

  return {
    isOpen: false,
    statusText: 'Closed Now',
    nextStatusText: `Opens at ${openTimeText}`,
    badgeColorClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    todayHoursDisplay,
    currentDayName,
    dayOfWeek,
    manualStatus: 'auto',
    isNoticeActive,
    activeNotice: isNoticeActive ? notice : null,
    operations: data,
  };
}

export const calculateLiveOperationsStatus = getLiveOperationalStatus;
