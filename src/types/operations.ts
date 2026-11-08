export interface DaySchedule {
  day: string;
  open: string;
  close: string;
  isOpen: boolean;
}

export interface ClosureNotice {
  enabled: boolean;
  title: string;
  message: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  reason?: string;
}

export type ManualStatusOverride = 'auto' | 'force_open' | 'force_closed';

export interface OperationsData {
  manualStatus: ManualStatusOverride;
  manualStatusNote?: string;
  updatedAt: string;
  updatedBy?: string;

  // Timings
  daysDisplay: string;
  hoursDisplay: string;
  shortHoursDisplay: string;
  kitchenClosesDisplay: string;
  regularOpenHour24: number;
  regularCloseHour24: number;
  fridayOpenHour24: number;
  fridayCloseHour24: number;
  schedule: DaySchedule[];

  // Closure Notice
  closureNotice: ClosureNotice;
}

export interface LiveOperationsStatus {
  isOpen: boolean;
  statusText: string;
  nextStatusText: string;
  badgeColorClass: string;
  todayHoursDisplay: string;
  currentDayName: string;
  dayOfWeek: number;
  manualStatus: ManualStatusOverride;
  isNoticeActive: boolean;
  activeNotice: ClosureNotice | null;
  operations: OperationsData;
}
