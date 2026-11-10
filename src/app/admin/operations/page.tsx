'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Power,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Save,
  RotateCcw,
  GitBranch,
  ShieldAlert,
  Info,
  CalendarRange,
  Sparkles,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import {
  OperationsData,
  LiveOperationsStatus,
  ManualStatusOverride,
  DaySchedule,
} from '@/types/operations';

export default function AdminOperationsPage() {
  const [operations, setOperations] = useState<OperationsData | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveOperationsStatus | null>(null);
  const [isFirebaseConfigured, setIsFirebaseConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch current operations settings
  const fetchOperations = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/operations', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setOperations(data.operations);
        setLiveStatus(data.liveStatus);
        setIsFirebaseConfigured(Boolean(data.isFirebaseConfigured));
      }
    } catch (err) {
      console.error('Error fetching operations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOperations();
  }, []);

  const broadcastUpdate = () => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel('sg_operations_channel');
        channel.postMessage({ type: 'operations_updated', timestamp: Date.now() });
        channel.close();
      } catch (e) {}
    }
  };

  // Save changes
  const handleSave = async (customPayload?: Partial<OperationsData>) => {
    if (!operations) return;
    setIsSaving(true);
    setStatusMessage(null);

    const payload = customPayload ? { ...operations, ...customPayload } : operations;

    try {
      const res = await fetch('/api/admin/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        setOperations(json.operations);
        setLiveStatus(json.liveStatus);
        setIsFirebaseConfigured(Boolean(json.isFirebaseConfigured));
        broadcastUpdate();
        setStatusMessage({
          type: 'success',
          text: json.isFirebaseConfigured
            ? '✓ Settings saved and synced with Firebase Realtime Database!'
            : '✓ Settings saved and updated immediately!',
        });
        setTimeout(() => setStatusMessage(null), 4000);
      } else {
        const errJson = await res.json().catch(() => ({}));
        const issues = Array.isArray(errJson.issues) ? ` ${errJson.issues.join('; ')}` : '';
        setStatusMessage({ type: 'error', text: `${errJson.error || 'Failed to save settings'}${issues}` });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Network error while saving' });
    } finally {
      setIsSaving(false);
    }
  };

  // Quick toggle status handler (immediate save)
  const handleQuickStatusChange = (status: ManualStatusOverride) => {
    if (!operations) return;
    const updated = { ...operations, manualStatus: status };
    setOperations(updated);
    handleSave({ manualStatus: status });
  };

  // Immediate toggle for Notice (active/disabled) with instant save
  const handleToggleNotice = async () => {
    if (!operations) return;
    const newEnabled = !operations.closureNotice.enabled;
    const updatedNotice = { ...operations.closureNotice, enabled: newEnabled };
    const updated = { ...operations, closureNotice: updatedNotice };
    setOperations(updated);
    await handleSave({ closureNotice: updatedNotice });
  };

  // Complete deletion of notice
  const handleDeleteNotice = async () => {
    if (!operations) return;
    const confirmed = window.confirm(
      'Are you sure you want to delete this notice? This will completely clear and remove the announcement from the public website.'
    );
    if (!confirmed) return;

    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteNotice: true }),
      });
      if (res.ok) {
        const json = await res.json();
        setOperations(json.operations);
        setLiveStatus(json.liveStatus);
        broadcastUpdate();
        setStatusMessage({
          type: 'success',
          text: '✓ Notice deleted and removed from the public website!',
        });
        setTimeout(() => setStatusMessage(null), 4000);
      } else {
        const errJson = await res.json();
        setStatusMessage({ type: 'error', text: errJson.error || 'Failed to delete notice' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Network error while deleting notice' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleScheduleChange = (index: number, field: keyof DaySchedule, value: any) => {
    if (!operations) return;
    const newSchedule = [...operations.schedule];
    newSchedule[index] = { ...newSchedule[index], [field]: value };
    setOperations({ ...operations, schedule: newSchedule });
  };

  if (isLoading || !operations) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
        <div className="h-44 w-full bg-gray-100 dark:bg-gray-900 rounded-3xl animate-pulse" />
        <div className="h-64 w-full bg-gray-100 dark:bg-gray-900 rounded-3xl animate-pulse" />
      </div>
    );
  }

  const notice = operations.closureNotice;

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-gray-900 dark:text-white flex items-center space-x-2.5">
            <Clock className="w-7 h-7 text-chili-600" />
            <span>Cafe Timings &amp; Status</span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage live cafe open/close availability, weekly operating schedule, and closure notices.
          </p>
        </div>

        {/* Storage / Database Status Indicator */}
        <div className="flex items-center space-x-2">
          {isFirebaseConfigured ? (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Firebase Realtime Database: Active</span>
            </div>
          ) : (
            <div
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
              title="Add FIREBASE_DATABASE_URL in .env.local to enable remote cloud persistence."
            >
              <Info className="w-3.5 h-3.5 text-amber-600" />
              <span>Local Dev Mode (Firebase Not Configured)</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-chili-600 hover:bg-chili-700 shadow-md shadow-chili-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save All Changes'}</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center space-x-2.5 animate-in slide-in-from-top-2 duration-200 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* SECTION 1: INSTANT OPEN / CLOSE OVERRIDE */}
      <div className="p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <Power className="w-4 h-4 text-chili-600" />
              <span>Instant Cafe Availability Override</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Instantly toggle the cafe to open or closed right now, or let it follow the standard weekly timetable.
            </p>
          </div>

          {liveStatus && (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400">Current Live State:</span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${liveStatus.badgeColorClass} flex items-center space-x-1.5`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    liveStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span>{liveStatus.statusText}</span>
              </span>
            </div>
          )}
        </div>

        {/* 3-Way Mode Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* Automatic Mode */}
          <button
            type="button"
            onClick={() => handleQuickStatusChange('auto')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              operations.manualStatus === 'auto'
                ? 'bg-chili-50/80 dark:bg-chili-950/40 border-chili-500 text-chili-950 dark:text-chili-100 ring-2 ring-chili-500/20'
                : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/80 hover:bg-gray-100 text-gray-700 dark:text-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">⚙️ Automatic (Schedule)</span>
              {operations.manualStatus === 'auto' && (
                <span className="w-2 h-2 rounded-full bg-chili-600" />
              )}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
              Opens &amp; closes automatically according to the weekly timings timetable below.
            </p>
          </button>

          {/* Force Open Mode */}
          <button
            type="button"
            onClick={() => handleQuickStatusChange('force_open')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              operations.manualStatus === 'force_open'
                ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/20'
                : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/80 hover:bg-gray-100 text-gray-700 dark:text-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                🟢 Force Open Now
              </span>
              {operations.manualStatus === 'force_open' && (
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
              )}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
              Forces cafe status to "Open Now" even outside standard operating hours.
            </p>
          </button>

          {/* Force Closed Mode */}
          <button
            type="button"
            onClick={() => handleQuickStatusChange('force_closed')}
            className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
              operations.manualStatus === 'force_closed'
                ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-500 text-rose-950 dark:text-rose-100 ring-2 ring-rose-500/20'
                : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/80 hover:bg-gray-100 text-gray-700 dark:text-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                🔴 Force Closed Now
              </span>
              {operations.manualStatus === 'force_closed' && (
                <span className="w-2 h-2 rounded-full bg-rose-600" />
              )}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
              Immediately marks cafe as "Temporarily Closed" (e.g. kitchen full, emergency, sold out).
            </p>
          </button>
        </div>

        {/* Optional Override Note */}
        {operations.manualStatus !== 'auto' && (
          <div className="pt-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Custom Status Message / Reason (Optional)
            </label>
            <input
              type="text"
              value={operations.manualStatusNote || ''}
              onChange={(e) =>
                setOperations({ ...operations, manualStatusNote: e.target.value })
              }
              placeholder="e.g. Closed early today for private celebration"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-chili-500"
            />
          </div>
        )}
      </div>

      {/* SECTION 2: TEMPORARY CLOSURE NOTICE PLANNER */}
      <div className="p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <CalendarRange className="w-4 h-4 text-chili-600" />
              <span>Temporary Closure &amp; Holiday Notice</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Plan scheduled closures for Durga Puja, festivals, maintenance, or private bookings with an active banner.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleNotice}
              disabled={isSaving}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                notice.enabled
                  ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-600/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              title={notice.enabled ? 'Click to disable and hide notice immediately' : 'Click to enable and show notice'}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${notice.enabled ? 'bg-white animate-pulse' : 'bg-gray-400'}`} />
              <span>{notice.enabled ? '🟢 Notice is Active on Website' : '⚪ Notice is Inactive (Hidden)'}</span>
            </button>

            {(notice.message || notice.title || notice.startDate) && (
              <button
                type="button"
                onClick={handleDeleteNotice}
                disabled={isSaving}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/80 transition-all flex items-center space-x-1.5 cursor-pointer"
                title="Delete this notice completely and clear fields"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Notice</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Notice Title
            </label>
            <input
              type="text"
              value={notice.title}
              onChange={(e) =>
                setOperations({
                  ...operations,
                  closureNotice: { ...notice, title: e.target.value },
                })
              }
              placeholder="e.g. Festive Holiday Closure"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-chili-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Reason / Category
            </label>
            <select
              value={notice.reason || 'Holiday'}
              onChange={(e) =>
                setOperations({
                  ...operations,
                  closureNotice: { ...notice, reason: e.target.value },
                })
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-chili-500"
            >
              <option value="Holiday">Festive Holiday (Durga Puja / Diwali / New Year)</option>
              <option value="Maintenance">Maintenance &amp; Deep Cleaning</option>
              <option value="Renovation">Ambiance Upgrade / Renovation</option>
              <option value="Private Event">Booked for Private Party</option>
              <option value="Special Notice">Special Announcement</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Start Date (Optional)
            </label>
            <input
              type="date"
              value={notice.startDate || ''}
              onChange={(e) =>
                setOperations({
                  ...operations,
                  closureNotice: { ...notice, startDate: e.target.value },
                })
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-chili-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              End Date / Reopening Date (Optional)
            </label>
            <input
              type="date"
              value={notice.endDate || ''}
              onChange={(e) =>
                setOperations({
                  ...operations,
                  closureNotice: { ...notice, endDate: e.target.value },
                })
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-chili-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Customer Notice Message
            </label>
            <textarea
              rows={2}
              value={notice.message}
              onChange={(e) =>
                setOperations({
                  ...operations,
                  closureNotice: { ...notice, message: e.target.value },
                })
              }
              placeholder="e.g. The Spicy Garden will remain closed from Oct 10 to Oct 12 for Durga Puja festivities. We look forward to welcoming you back on Oct 13 with fresh specials!"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-chili-500"
            />
          </div>
        </div>

        {/* Live Banner Preview */}
        {notice.enabled && (
          <div className="pt-2">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">
              Website Banner Preview:
            </span>
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-600 via-rose-600 to-chili-700 text-white shadow-md flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 animate-pulse" />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold uppercase text-[10px] px-2 py-0.5 rounded bg-white text-rose-700 font-sans">
                      {notice.reason || 'Notice'}
                    </span>
                    <span className="font-bold">{notice.title || 'Special Notice'}</span>
                    {(notice.startDate || notice.endDate) && (
                      <span className="text-[11px] bg-black/20 px-2 py-0.5 rounded">
                        {notice.startDate && notice.endDate
                          ? `${notice.startDate} to ${notice.endDate}`
                          : notice.startDate
                          ? `From ${notice.startDate}`
                          : `Until ${notice.endDate}`}
                      </span>
                    )}
                  </div>
                  {notice.message && <p className="text-[11px] mt-0.5 text-white/90">{notice.message}</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dedicated Save Notice Action Bar */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {notice.enabled
              ? '✓ This notice is LIVE and active as an announcement banner on the public website.'
              : 'Notice is currently hidden from website visitors. Click "Enable & Publish Now" to make it live.'}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {(notice.message || notice.title || notice.startDate) && (
              <button
                type="button"
                onClick={handleDeleteNotice}
                disabled={isSaving}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/80 transition-all cursor-pointer"
                title="Completely delete this notice from the website and clear all fields"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Notice</span>
              </button>
            )}

            {!notice.enabled ? (
              <button
                type="button"
                onClick={async () => {
                  const updatedNotice = { ...notice, enabled: true };
                  const updatedOps = { ...operations, closureNotice: updatedNotice };
                  setOperations(updatedOps);
                  await handleSave({ closureNotice: updatedNotice });
                }}
                disabled={isSaving}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-sm cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Enable &amp; Publish Now</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleToggleNotice}
                disabled={isSaving}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 active:scale-95 transition-all cursor-pointer"
              >
                <Power className="w-3.5 h-3.5 text-rose-500" />
                <span>Disable Notice (Hide)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSave()}
              disabled={isSaving}
              className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-chili-600 hover:bg-chili-700 active:scale-95 shadow-sm transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Publishing...' : 'Save & Update Notice'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 3: WEEKLY TIMINGS SCHEDULE */}
      <div className="p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-6">
        <div className="pb-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <Clock className="w-4 h-4 text-chili-600" />
            <span>Weekly Operating Hours</span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Configure opening and closing times for each day of the week.
          </p>
        </div>

        {/* Days Table */}
        <div className="space-y-3">
          {operations.schedule.map((item, idx) => (
            <div
              key={item.day}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 gap-3"
            >
              <div className="flex items-center space-x-3 w-40">
                <input
                  type="checkbox"
                  id={`day-open-${item.day}`}
                  checked={item.isOpen}
                  onChange={(e) => handleScheduleChange(idx, 'isOpen', e.target.checked)}
                  className="w-4 h-4 rounded text-chili-600 focus:ring-chili-500 cursor-pointer"
                />
                <label
                  htmlFor={`day-open-${item.day}`}
                  className={`text-xs font-bold cursor-pointer ${
                    item.isOpen
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-400 line-through'
                  }`}
                >
                  {item.day}
                </label>
              </div>

              {item.isOpen ? (
                <div className="flex items-center space-x-2 text-xs flex-1 sm:justify-end">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] text-gray-400">Opens:</span>
                    <input
                      type="text"
                      value={item.open}
                      onChange={(e) => handleScheduleChange(idx, 'open', e.target.value)}
                      placeholder="e.g. 2:00 PM"
                      className="w-28 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-chili-500"
                    />
                  </div>

                  <span className="text-gray-400">—</span>

                  <div className="flex items-center space-x-1.5">
                    <span className="text-[11px] text-gray-400">Closes:</span>
                    <input
                      type="text"
                      value={item.close}
                      onChange={(e) => handleScheduleChange(idx, 'close', e.target.value)}
                      placeholder="e.g. 11:30 PM"
                      className="w-28 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-chili-500"
                    />
                  </div>
                </div>
              ) : (
                <span className="text-xs font-semibold text-rose-500 italic">
                  Closed on this day
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Display Summaries */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Public Hours Summary Text
            </label>
            <input
              type="text"
              value={operations.hoursDisplay}
              onChange={(e) =>
                setOperations({ ...operations, hoursDisplay: e.target.value })
              }
              placeholder="e.g. Mon–Thu, Sat–Sun: 2:00 PM – 11:30 PM | Fri: 1:00 PM – 11:00 PM"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-chili-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Kitchen Closes Notice
            </label>
            <input
              type="text"
              value={operations.kitchenClosesDisplay}
              onChange={(e) =>
                setOperations({ ...operations, kitchenClosesDisplay: e.target.value })
              }
              placeholder="e.g. Last Kitchen Order: 30 minutes before closing"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-chili-500"
            />
          </div>
        </div>

        {/* Save Footer Button */}
        <div className="pt-4 flex justify-end">
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-chili-600 hover:bg-chili-700 shadow-md shadow-chili-600/30 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save & Publish All Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
