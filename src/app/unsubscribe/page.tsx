'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { RESTAURANT_DATA } from '@/data/restaurantData';

/** Public opt-out page for WhatsApp offers (linked from broadcasts). */
export default function UnsubscribePage() {
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    setMessage(null);
    try {
      const res = await fetch('/api/whatsapp/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not process your request.');
      setState('done');
      setMessage(data.message);
    } catch (err) {
      setState('error');
      setMessage(err instanceof Error ? err.message : 'Could not process your request.');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-16 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <h1 className="font-serif text-2xl font-bold text-gray-900 dark:text-white">Stop WhatsApp offers</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Enter the mobile number that receives offers from {RESTAURANT_DATA.brand.name}. We&apos;ll remove it from
          our WhatsApp list. Order confirmations you request are not affected.
        </p>

        {state === 'done' ? (
          <p role="status" className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-sm text-emerald-800 dark:text-emerald-200">
            {message}
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300" htmlFor="unsub-phone">
              Mobile number
            </label>
            <input
              id="unsub-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              required
              maxLength={16}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit mobile number"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {state === 'error' && message && (
              <p role="alert" className="text-xs text-rose-600">
                {message}
              </p>
            )}
            <button
              type="submit"
              disabled={state === 'sending'}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 disabled:opacity-60"
            >
              {state === 'sending' ? 'Removing…' : 'Unsubscribe'}
            </button>
          </form>
        )}

        <Link href="/" className="inline-block text-xs font-semibold text-emerald-700 dark:text-emerald-400 underline">
          Back to the website
        </Link>
      </div>
    </main>
  );
}
