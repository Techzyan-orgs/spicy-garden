'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MessageSquareShare,
  Send,
  Users,
  ShieldCheck,
  Download,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Phone,
  Eye,
  EyeOff,
  Trash2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Flame,
  Info,
  Check,
  Copy,
} from 'lucide-react';
import { maskPhoneNumber } from '@/lib/crypto';

interface Subscriber {
  id: string;
  phone: string;
  formattedPhone: string;
  customerName: string;
  source: string;
  interestScore?: number;
  consentGiven: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageSentAt?: string;
  lastMessageStatus?: 'delivered' | 'sent' | 'failed' | 'pending';
  lastCampaignName?: string;
}

interface MarketingStats {
  total: number;
  addedToday: number;
  lastBroadcastAt: string | null;
  lastBroadcastCampaign: string | null;
  isApiConfigured: boolean;
}

const PRESET_CAMPAIGNS = [
  {
    id: 'weekend_pizza',
    title: 'Weekend Pizza Bonanza',
    text: `🍕 *Weekend Feast at The Spicy Garden!* 🍕\n\nHey foodie! Craving piping hot cheesy gourmet pizza? Order any 2 Large Pizzas today and enjoy *FREE Cheesy Garlic Bread* on us! 🧀✨\n\n📍 Dine-in at Baguiati or order directly at: https://spicygardencafe.com\n📞 Call/WhatsApp: +91 87778 66602`,
  },
  {
    id: 'momo_fest',
    title: 'Tibetan Momo Festival',
    text: `🥟 *Momo Madness at The Spicy Garden!* 🥟\n\nAuthentic Tibetan steamed & crispy fried momos served with our signature fiery red chutney & soothing clear soup! Enjoy *Flat 15% OFF* on all Momos today!\n\nVisit us today or tap to order: https://spicygardencafe.com`,
  },
  {
    id: 'burger_combo',
    title: 'Bistro Evening Chill',
    text: `🍔 *Bistro Chill Hours!* 🥤\n\nPair our loaded gourmet burgers with crispy French fries and chilled mocktails. Student & family friendly combos starting from just ₹79!\n\nCheck out the full menu: https://spicygardencafe.com`,
  },
  {
    id: 'custom',
    title: 'Custom Announcement',
    text: '',
  },
];

export default function AdminMarketingPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<MarketingStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [maskNumbers, setMaskNumbers] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Broadcast Studio State
  const [selectedPreset, setSelectedPreset] = useState<string>('weekend_pizza');
  const [campaignTitle, setCampaignTitle] = useState<string>('Weekend Pizza Bonanza');
  const [messageText, setMessageText] = useState<string>(PRESET_CAMPAIGNS[0].text);
  const [testPhoneNumber, setTestPhoneNumber] = useState<string>('');
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);
  const [broadcastProgress, setBroadcastProgress] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Manual Add Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newPhone, setNewPhone] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchSubscribers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/whatsapp/subscribers');
      if (res.ok) {
        const data = await res.json();
        setSubscribers(data.subscribers || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error('[Admin Marketing] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    const found = PRESET_CAMPAIGNS.find((p) => p.id === presetId);
    if (found) {
      setCampaignTitle(found.title);
      if (found.id !== 'custom') {
        setMessageText(found.text);
      }
    }
  };

  const handleCopyPhone = (id: string, phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendTest = async () => {
    setFeedback(null);
    const cleanTest = testPhoneNumber.replace(/\D/g, '').slice(-10);
    if (cleanTest.length < 10) {
      setFeedback({ type: 'error', message: 'Please enter a valid 10-digit test phone number.' });
      return;
    }

    setIsSendingTest(true);
    try {
      const res = await fetch('/api/admin/whatsapp/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignTitle: `${campaignTitle} (Test)`,
          messageText,
          target: 'test',
          testPhone: cleanTest,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send test preview.');
      }

      setFeedback({ type: 'success', message: data.message || `Test message sent to +91 ${cleanTest}!` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to send test preview.' });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleExecuteBroadcast = async () => {
    setShowConfirmModal(false);
    setIsBroadcasting(true);
    setBroadcastProgress(`Dispatching to ${subscribers.length} customers...`);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/whatsapp/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignTitle,
          messageText,
          target: 'all',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Broadcast execution failed.');
      }

      setFeedback({
        type: 'success',
        message: `Campaign Broadcast Complete! Sent: ${data.sentCount}, Failed: ${data.failedCount}`,
      });
      fetchSubscribers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Broadcast campaign failed.' });
    } finally {
      setIsBroadcasting(false);
      setBroadcastProgress(null);
    }
  };

  const handleAddSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newPhone.replace(/\D/g, '').slice(-10);
    if (clean.length < 10) {
      setFeedback({ type: 'error', message: 'Please enter a valid 10-digit mobile number.' });
      return;
    }

    setIsAdding(true);
    try {
      const res = await fetch('/api/admin/whatsapp/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: clean,
          customerName: newName.trim() || undefined,
          source: 'manual_walk_in',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add subscriber.');

      setFeedback({ type: 'success', message: `Customer +91 ${clean} added with consent recorded.` });
      setNewPhone('');
      setNewName('');
      setShowAddModal(false);
      fetchSubscribers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to add subscriber.' });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteSubscriber = async (id: string, phone: string) => {
    if (!confirm(`Are you sure you want to remove ${phone} from marketing list?`)) return;

    try {
      const res = await fetch(`/api/admin/whatsapp/subscribers?id=${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete subscriber.');

      setFeedback({ type: 'success', message: 'Subscriber removed.' });
      fetchSubscribers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete.' });
    }
  };

  const handleExportCSV = () => {
    if (subscribers.length === 0) {
      setFeedback({ type: 'error', message: 'No subscribers to export.' });
      return;
    }

    const sanitizeCell = (val: string): string => {
      let clean = String(val || '').replace(/"/g, '""');
      // Neutralize spreadsheet formula/DDE triggers (=, +, -, @, tab, CR)
      if (/^[=+\-@\t\r]/.test(clean)) {
        clean = `'${clean}`;
      }
      return `"${clean}"`;
    };

    const headers = ['Phone Number', 'Customer Name', 'Consent Source', 'Opt-In Date', 'Last Notified'];
    const rows = subscribers.map((s) => [
      sanitizeCell(s.phone),
      sanitizeCell(s.customerName || 'Guest'),
      sanitizeCell(s.source),
      sanitizeCell(new Date(s.createdAt).toLocaleDateString()),
      sanitizeCell(s.lastMessageSentAt ? new Date(s.lastMessageSentAt).toLocaleDateString() : 'Never'),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.map(sanitizeCell).join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `spicy_garden_whatsapp_subscribers_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredSubscribers = useMemo(() => {
    if (!searchQuery.trim()) return subscribers;
    const q = searchQuery.toLowerCase();
    return subscribers.filter(
      (s) => s.phone.includes(q) || s.customerName.toLowerCase().includes(q) || s.source.toLowerCase().includes(q)
    );
  }, [subscribers, searchQuery]);

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MessageSquareShare className="w-5 h-5" />
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              WhatsApp Marketing
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Privacy-first subscriber list &amp; automated 1-click marketing broadcasts via Meta WhatsApp Cloud API.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={fetchSubscribers}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={subscribers.length === 0}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/30 transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Consented Subscribers */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Subscribers</span>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-gray-900 dark:text-white font-sans">
                {stats?.total ?? subscribers.length}
              </span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                Active Opt-ins
              </span>
            </div>
            <p className="text-[11px] text-gray-400">Consented via website &amp; counter</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Security & Encryption Status */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">PII Data Protection</span>
            <div className="flex items-baseline space-x-2">
              <span className="text-base font-bold text-gray-900 dark:text-white">AES-256-GCM</span>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-full">
                DPDP Ready
              </span>
            </div>
            <p className="text-[11px] text-gray-400">Encrypted at rest • Owner-only access</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Last Campaign Dispatched */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Last Broadcast</span>
            <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
              {stats?.lastBroadcastCampaign || 'No campaign sent yet'}
            </div>
            <p className="text-[11px] text-gray-400">
              {stats?.lastBroadcastAt ? new Date(stats.lastBroadcastAt).toLocaleDateString() : 'Ready to launch'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* WhatsApp Business API Status */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Meta Cloud API</span>
            <div className="flex items-baseline space-x-2">
              {stats?.isApiConfigured ? (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full">
                  ● Connected
                </span>
              ) : (
                <span className="text-xs font-bold text-amber-600 bg-amber-100 dark:bg-amber-950 px-2.5 py-0.5 rounded-full">
                  Direct wa.me Mode
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400">
              {stats?.isApiConfigured ? 'Automated API enabled' : '1-Click Direct Chat ready'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Broadcast Studio Card (1-Click Marketing Campaign Trigger) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-white via-white to-gray-50/50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 border border-gray-200 dark:border-gray-800 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-chili-500/10 text-chili-600 dark:text-chili-400">
                <Flame className="w-4 h-4 fill-chili-500 text-chili-500" />
              </span>
              <h3 className="font-serif text-lg font-bold text-gray-900 dark:text-white">
                Automated Marketing Broadcast Studio
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Select or draft a promotion and dispatch it automatically to all {subscribers.length} customers.
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl">
            {PRESET_CAMPAIGNS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPreset(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedPreset === p.id
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {p.title}
              </button>
            ))}
          </div>
        </div>

        {/* Campaign Input Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Campaign Title / Reference
              </label>
              <input
                type="text"
                value={campaignTitle}
                onChange={(e) => setCampaignTitle(e.target.value)}
                placeholder="e.g. Weekend 15% OFF Chef Special"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Message Content (WhatsApp Formatted)
                </label>
                <span className="text-[10px] text-gray-400 font-mono">{messageText.length} characters</span>
              </div>
              <textarea
                rows={5}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your WhatsApp message with formatting (*bold*, _italic_, links)..."
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-sans bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 leading-relaxed font-mono"
              />
            </div>
          </div>

          {/* Action & Test Send Column */}
          <div className="p-4 rounded-2xl bg-gray-50/70 dark:bg-gray-800/40 border border-gray-200/80 dark:border-gray-700/60 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Safety Test &amp; Preview</span>
              </h4>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                Test the message preview on your own phone before broadcasting to all customers.
              </p>

              <div>
                <input
                  type="tel"
                  value={testPhoneNumber}
                  onChange={(e) => setTestPhoneNumber(e.target.value)}
                  placeholder="Your 10-digit number"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-mono"
                />
                <button
                  type="button"
                  onClick={handleSendTest}
                  disabled={isSendingTest || !testPhoneNumber.trim()}
                  className="w-full mt-2 py-2 rounded-xl text-xs font-semibold bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white transition-all disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {isSendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{isSendingTest ? 'Sending Test...' : 'Send Test Preview'}</span>
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                disabled={isBroadcasting || subscribers.length === 0 || !messageText.trim()}
                className="w-full py-3 rounded-2xl text-xs font-black uppercase tracking-wider text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-600/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isBroadcasting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{broadcastProgress || 'Dispatching...'}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>1-Click Broadcast ({subscribers.length})</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-center text-gray-400">
                Dispatched with rate-limiting to comply with Meta API limits.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Subscribers Table Section */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        {/* Table Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-bold text-gray-900 dark:text-white">
              Customer Opt-In Directory
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {filteredSubscribers.length} of {subscribers.length} consented contacts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search phone or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white w-48 sm:w-60 focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Privacy Mask Toggle */}
            <button
              type="button"
              onClick={() => setMaskNumbers(!maskNumbers)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-750 transition-colors cursor-pointer"
              title={maskNumbers ? 'Reveal full phone numbers' : 'Mask phone numbers for privacy'}
            >
              {maskNumbers ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{maskNumbers ? 'Reveal Numbers' : 'Mask Numbers'}</span>
            </button>
          </div>
        </div>

        {/* Directory Table */}
        <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 uppercase font-semibold tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">WhatsApp Number</th>
                <th className="py-3 px-4">Opt-In Date</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Last Broadcast</th>
                <th className="py-3 px-4 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-medium">
              {filteredSubscribers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No opted-in WhatsApp contacts found.</p>
                  </td>
                </tr>
              ) : (
                filteredSubscribers.map((sub) => {
                  const displayPhone = maskNumbers ? maskPhoneNumber(sub.phone) : sub.phone;
                  const waLink = `https://wa.me/91${sub.phone}?text=${encodeURIComponent(
                    `Hi ${sub.customerName || 'there'}! Greetings from The Spicy Garden Cafe & Bistro 🌶️`
                  )}`;

                  return (
                    <tr
                      key={sub.id}
                      className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors group"
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-gray-900 dark:text-white">
                          {sub.customerName || 'Valued Guest'}
                        </div>
                        {sub.interestScore && sub.interestScore > 0 ? (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">
                            ★ High Interest ({sub.interestScore}pts)
                          </span>
                        ) : null}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2 font-mono text-gray-800 dark:text-gray-200 font-semibold">
                          <span>+91 {displayPhone}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyPhone(sub.id, sub.phone)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                            title="Copy phone"
                          >
                            {copiedId === sub.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400">
                        {new Date(sub.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                          {sub.source.replace(/_/g, ' ')}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {sub.lastMessageSentAt ? (
                          <div className="space-y-0.5">
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Delivered</span>
                            </span>
                            <p className="text-[10px] text-gray-400 truncate max-w-[140px]">
                              {sub.lastCampaignName || 'Broadcast'}
                            </p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400">Never</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {/* 1-Click WhatsApp Web Link */}
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 transition-colors shadow-xs"
                            title="Open direct chat in WhatsApp"
                          >
                            <span>Chat</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleDeleteSubscriber(sub.id, sub.phone)}
                            className="p-1 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                            title="Remove subscriber"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-6 w-full max-w-md border border-gray-200 dark:border-gray-800 shadow-2xl space-y-4">
            <h3 className="font-serif text-lg font-bold text-gray-900 dark:text-white">
              Add Customer WhatsApp Consent
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Manually add a walk-in guest who gave consent for WhatsApp specials and discounts.
            </p>

            <form onSubmit={handleAddSubscriber} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  Customer Name (Optional)
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">
                  WhatsApp Number (10 Digits) *
                </label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm disabled:opacity-50 flex items-center space-x-1"
                >
                  {isAdding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Contact</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal Before Live Broadcast */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-6 w-full max-w-md border border-gray-200 dark:border-gray-800 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="font-serif text-lg font-bold text-gray-900 dark:text-white">
                Launch Marketing Broadcast?
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                You are about to dispatch <strong>"{campaignTitle}"</strong> to{' '}
                <strong>{subscribers.length} opted-in WhatsApp customers</strong>.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-[11px] text-gray-600 dark:text-gray-300 font-mono line-clamp-3">
              {messageText}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBroadcast}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm"
              >
                Confirm &amp; Broadcast
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
