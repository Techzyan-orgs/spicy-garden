/**
 * Café operations (timings, open/closed status, closure notices).
 * Firebase Realtime Database (/operations) is the single source of truth.
 *
 * There are NO hardcoded default hours. If the record is missing, invalid or
 * the database is unreachable, reads throw and callers respond with 503 —
 * the site never guesses whether the café is open. Initial data is created
 * with `node scripts/seed-operations.mjs`.
 */
import { z } from 'zod';
import { OperationsData, LiveOperationsStatus } from '@/types/operations';
import { dbGet, dbSet, DataUnavailableError } from './firebaseAdmin';

const TIME_12H = /^(0?[1-9]|1[0-2]):[0-5]\d\s?(AM|PM)$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const hour24 = z.number().min(0).max(24);
const optionalDate = z.union([z.literal(''), z.string().regex(ISO_DATE, 'Expected YYYY-MM-DD')]).optional();

export const operationsSchema = z.object({
  manualStatus: z.enum(['auto', 'force_open', 'force_closed']),
  manualStatusNote: z.string().max(120).optional().default(''),
  updatedAt: z.string(),
  updatedBy: z.string().max(80).optional(),
  daysDisplay: z.string().min(1).max(120),
  hoursDisplay: z.string().min(1).max(200),
  shortHoursDisplay: z.string().min(1).max(120),
  kitchenClosesDisplay: z.string().min(1).max(120),
  regularOpenHour24: hour24,
  regularCloseHour24: hour24,
  fridayOpenHour24: hour24,
  fridayCloseHour24: hour24,
  schedule: z
    .array(
      z.object({
        day: z.enum(DAY_NAMES),
        open: z.string().regex(TIME_12H, 'Expected time like 2:00 PM'),
        close: z.string().regex(TIME_12H, 'Expected time like 11:30 PM'),
        isOpen: z.boolean(),
      })
    )
    .length(7)
    .refine((days) => new Set(days.map((d) => d.day)).size === 7, 'Schedule must list each day exactly once'),
  closureNotice: z.object({
    enabled: z.boolean(),
    title: z.string().max(120),
    message: z.string().max(1000),
    startDate: optionalDate,
    endDate: optionalDate,
    reason: z.string().max(80).optional(),
  }),
});

export class OperationsNotConfiguredError extends DataUnavailableError {
  constructor() {
    super('Café operations have not been configured in the database. Run `node scripts/seed-operations.mjs --apply`.');
    this.name = 'OperationsNotConfiguredError';
  }
}

export class OperationsValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid operations data: ${issues.join('; ')}`);
    this.name = 'OperationsValidationError';
  }
}

function formatIssues(err: z.ZodError): string[] {
  return err.issues.map((i) => `${i.path.join('.') || 'operations'}: ${i.message}`);
}

/** Validates operations data, throwing OperationsValidationError with readable issues. */
export function validateOperationsData(input: unknown): OperationsData {
  const parsed = operationsSchema.safeParse(input);
  if (!parsed.success) throw new OperationsValidationError(formatIssues(parsed.error));
  return parsed.data as OperationsData;
}

const CACHE_TTL_MS = 30_000;
let cache: { data: OperationsData; at: number } | null = null;

/**
 * Reads operations data from Firebase. Throws OperationsNotConfiguredError if
 * absent, DataUnavailableError if unreachable or invalid.
 */
export async function readOperationsFromStore(forceFresh = false): Promise<OperationsData> {
  if (!forceFresh && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const raw = await dbGet<unknown>('operations');
  if (raw === null) throw new OperationsNotConfiguredError();

  let data: OperationsData;
  try {
    data = validateOperationsData(raw);
  } catch (err) {
    console.error('[OperationsStore] Stored operations data is invalid:', err instanceof Error ? err.message : err);
    throw new DataUnavailableError('Stored café operations data is invalid.', { cause: err });
  }

  cache = { data, at: Date.now() };
  return data;
}

/** Validates and persists operations data. Throws on validation or write failure. */
export async function writeOperationsToStore(input: OperationsData): Promise<OperationsData> {
  const data = validateOperationsData(input);
  await dbSet('operations', data);
  cache = { data, at: Date.now() };
  return data;
}

/** Formats a decimal 24h hour (e.g. 23.5) as "11:30 PM". */
function formatHour24(value: number): string {
  const totalMinutes = Math.round(value * 60) % (24 * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
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
export function getLiveOperationalStatus(data: OperationsData): LiveOperationsStatus {

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
  const openTimeText = todaySchedule?.open || formatHour24(defaultOpen);
  const closeTimeText = todaySchedule?.close || formatHour24(defaultClose);
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
