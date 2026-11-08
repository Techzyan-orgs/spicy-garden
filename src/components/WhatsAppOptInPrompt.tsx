'use client';

import React, { useState, useEffect } from 'react';
import { trackEvent, getCurrentInterestScore } from '@/lib/analytics';
import { MessageCircle, X, Bell, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';

function isOptInEligible(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NEXT_PUBLIC_ENABLE_WHATSAPP_OPTIN === 'false') return false;

  // Never show again in the same browser session if dismissed
  if (sessionStorage.getItem('sg_wa_dismissed_session') === 'true') {
    return false;
  }

  // Never show if already consented
  if (localStorage.getItem('sg_wa_consented') === 'true') {
    return false;
  }

  // Check multi-day cooldown in localStorage
  const cooldownUntil = localStorage.getItem('sg_wa_cooldown');
  if (cooldownUntil && Date.now() < parseInt(cooldownUntil, 10)) {
    return false;
  }

  return true;
}

export default function WhatsAppOptInPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOptInEligible()) {
      return;
    }

    const threshold = parseInt(
      process.env.NEXT_PUBLIC_WHATSAPP_OPTIN_SCORE_THRESHOLD || '10',
      10
    );

    const checkThreshold = () => {
      if (!isOptInEligible()) return;
      const score = getCurrentInterestScore();
      if (score >= threshold) {
        setIsVisible(true);
      }
    };

    // Track scroll depth
    let scroll50Tracked = false;
    let scroll75Tracked = false;
    const handleScroll = () => {
      if (!isOptInEligible()) return;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;
      const progress = window.scrollY / scrollHeight;

      if (progress >= 0.4 && !scroll50Tracked) {
        scroll50Tracked = true;
        trackEvent('scroll_depth_50');
      }
      if (progress >= 0.75 && !scroll75Tracked) {
        scroll75Tracked = true;
        trackEvent('scroll_depth_75');
      }
    };

    // Track time spent on site
    const timer30 = setTimeout(() => {
      if (isOptInEligible()) trackEvent('time_spent_30s');
    }, 30000);

    const timer60 = setTimeout(() => {
      if (isOptInEligible()) trackEvent('time_spent_60s');
    }, 60000);

    // Initial check
    checkThreshold();

    // Listen for real-time interest score updates from trackEvent
    const handleScoreUpdate = (e: any) => {
      if (!isOptInEligible()) return;
      if (e.detail?.score >= threshold) {
        setIsVisible(true);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('sg_interest_score_updated', handleScoreUpdate);

    return () => {
      clearTimeout(timer30);
      clearTimeout(timer60);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('sg_interest_score_updated', handleScoreUpdate);
    };
  }, []);

  const handleDismiss = (days: number) => {
    setIsVisible(false);
    // Prevent ever showing again in the same browser session
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('sg_wa_dismissed_session', 'true');
      const cooldownMs = days * 24 * 60 * 60 * 1000;
      localStorage.setItem('sg_wa_cooldown', (Date.now() + cooldownMs).toString());
    }
  };

  const handleConsentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit WhatsApp number.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/whatsapp/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          customerName: name.trim() || undefined,
          consentGiven: true,
          source: 'behavioral_interest_prompt',
          metadata: {
            interestScore: getCurrentInterestScore(),
            userAgent: navigator.userAgent,
            consentedAt: new Date().toISOString(),
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to save preferences.');

      setIsSuccess(true);
      localStorage.setItem('sg_wa_consented', 'true');
      sessionStorage.setItem('sg_wa_dismissed_session', 'true');
      localStorage.removeItem('sg_wa_cooldown');

      setTimeout(() => {
        setIsVisible(false);
      }, 2500);
    } catch {
      setError('Could not subscribe right now. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 max-w-sm w-[calc(100vw-2rem)] animate-in slide-in-from-bottom-5 duration-300">
      <div className="relative p-4 sm:p-5 rounded-2xl bg-white dark:bg-gray-900 border border-emerald-500/30 dark:border-emerald-500/30 shadow-2xl shadow-emerald-600/10 backdrop-blur-md">
        {/* Close Button */}
        <button
          onClick={() => handleDismiss(3)}
          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>

        {isSuccess ? (
          <div className="py-2 text-center flex flex-col items-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-1.5" />
            <p className="font-bold text-sm text-gray-900 dark:text-white">
              You're all set!
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              We'll send you our chef's weekend specials and exclusive discount codes on WhatsApp.
            </p>
          </div>
        ) : !isExpanded ? (
          /* Subtle Initial Prompt */
          <div>
            <div className="flex items-start space-x-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div className="pr-6">
                <h4 className="font-serif font-bold text-sm text-gray-900 dark:text-white">
                  Want updates &amp; offers on WhatsApp?
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                  Get occasional chef specials, festive offers &amp; instant party booking perks.
                </p>
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => handleDismiss(7)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-600/20 active:scale-95 transition-all"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Enable WhatsApp</span>
              </button>
            </div>
          </div>
        ) : (
          /* Expanded Explicit Opt-In Form */
          <form onSubmit={handleConsentSubmit} className="space-y-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Confirm Opt-in
              </span>
              <h4 className="font-serif font-bold text-sm text-gray-900 dark:text-white">
                Enter your WhatsApp Number
              </h4>
            </div>

            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {error}
              </p>
            )}

            <div className="space-y-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name (Optional)"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit WhatsApp Number"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
              By enabling, you consent to receive occasional offers from The Spicy Garden. Never spammed. Reply STOP anytime.
            </p>

            <div className="pt-1 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center space-x-1 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <span>Subscribe</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
