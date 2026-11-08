'use client';

import React, { useState, useEffect, useTransition, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AudioAlertProvider, useAudioAlert } from '@/context/AudioAlertContext';
import {
  LayoutDashboard,
  BellRing,
  UtensilsCrossed,
  FolderTree,
  Volume2,
  VolumeX,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Sparkles,
  MessageSquareShare,
  Clock,
  PartyPopper,
} from 'lucide-react';
import AdminContentLoader from '@/components/AdminContentLoader';

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activePath, setActivePath] = useState(pathname);
  const [showContentLoader, setShowContentLoader] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Synchronize optimistic activePath whenever actual route pathname changes
  useEffect(() => {
    setActivePath(pathname);
    setShowContentLoader(false);
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [pathname]);

  // Grace threshold: only show heavy skeleton if transition takes > 300ms
  // Eliminates useless loading screen flash on fast/cached section switches
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPending || activePath !== pathname) {
      timer = setTimeout(() => {
        setShowContentLoader(true);
      }, 300);
    } else {
      setShowContentLoader(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isPending, activePath, pathname]);

  const isNavigating = isPending || activePath !== pathname;

  const handleNavClick = (href: string, e?: React.MouseEvent) => {
    // Allow modifier keys or middle-clicks to open new tabs natively
    if (e && (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) {
      return;
    }
    if (e) {
      e.preventDefault();
    }
    if (href === pathname) {
      return;
    }
    setActivePath(href);
    startTransition(() => {
      router.push(href);
    });
  };
  const {
    soundEnabled,
    toggleSound,
    triggerChime,
    unlockAudioManually,
    activeOrderAlert,
    dismissOrderAlert,
    recentOrders,
    acknowledgeOrder,
  } = useAudioAlert();

  const isLoginPage = pathname === '/admin/login';
  const pendingCount = recentOrders.length;

  const navItems = [
    { label: 'Overview', href: '/admin', icon: LayoutDashboard },
    {
      label: 'Pending Orders',
      href: '/admin/orders',
      icon: BellRing,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    { label: 'Menu Items', href: '/admin/menu', icon: UtensilsCrossed },
    { label: 'Categories', href: '/admin/categories', icon: FolderTree },
    { label: 'Timings & Status', href: '/admin/operations', icon: Clock },
    { label: 'WhatsApp Marketing', href: '/admin/marketing', icon: MessageSquareShare },
  ];

  // Prefetch all admin navigation destinations for instant response
  useEffect(() => {
    if (isLoginPage) return;
    navItems.forEach((item) => {
      router.prefetch(item.href);
    });
  }, [router, isLoginPage]);

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (e) {}
    router.push('/admin/login');
    router.refresh();
  };

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="h-screen w-full flex flex-col md:flex-row overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 h-screen sticky top-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-5 justify-between overflow-y-auto">
        <div className="space-y-6">
          {/* Brand */}
          <div>
            <Link
              href="/admin"
              onClick={(e) => handleNavClick('/admin', e)}
              className="flex items-center space-x-2.5"
            >
              <div className="w-8 h-8 rounded-xl bg-chili-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-chili-600/30">
                SG
              </div>
              <div>
                <h1 className="font-serif font-bold text-sm text-gray-900 dark:text-white leading-tight">
                  The Spicy Garden
                </h1>
                <span className="text-[10px] font-semibold text-chili-600 dark:text-chili-400 uppercase tracking-wider">
                  Owner Portal
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="space-y-1.5" aria-label="Admin Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePath === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(item.href, e)}
                  onMouseEnter={() => router.prefetch(item.href)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-chili-600 text-white shadow-md shadow-chili-600/25'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/80 hover:text-chili-600'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive
                          ? 'bg-white text-chili-700'
                          : 'bg-rose-500 text-white animate-pulse'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Tools & Profile */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
          {/* Audio Alert Toggle */}
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={toggleSound}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                soundEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <VolumeX className="w-4 h-4 text-gray-400" />
                )}
                <span>Sound Alerts</span>
              </div>
              <span className="text-[10px] uppercase font-bold">
                {soundEnabled ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              onClick={unlockAudioManually}
              className="w-full text-center py-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700 hover:underline flex items-center justify-center space-x-1 cursor-pointer"
            >
              <span>🔊 Test Sound Chime</span>
            </button>
          </div>

          {/* Public Site Link */}
          <Link
            href="/"
            target="_blank"
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-chili-600" />
              <span>View Public Site</span>
            </span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header Bar */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <Link
          href="/admin"
          onClick={(e) => handleNavClick('/admin', e)}
          className="flex items-center space-x-2"
        >
          <div className="w-7 h-7 rounded-lg bg-chili-600 flex items-center justify-center text-white font-bold text-xs">
            SG
          </div>
          <span className="font-serif font-bold text-sm text-gray-900 dark:text-white">
            Spicy Garden Owner
          </span>
        </Link>

        <div className="flex items-center space-x-2">
          <button
            onClick={toggleSound}
            className={`p-2 rounded-lg border ${
              soundEnabled
                ? 'bg-emerald-50 text-emerald-600 border-emerald-300'
                : 'bg-gray-100 text-gray-400 border-gray-200'
            }`}
            title="Toggle order chime"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
            aria-label="Toggle navigation drawer"
          >
            {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 space-y-2 flex-shrink-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePath === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  handleNavClick(item.href, e);
                  setMobileNavOpen(false);
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold ${
                  isActive
                    ? 'bg-chili-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main ref={mainRef} className="flex-1 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl w-full relative">
        {/* Subtle Top Accent Progress Line when navigating */}
        {isNavigating && (
          <div className="absolute top-0 left-0 right-0 h-1 z-40 overflow-hidden pointer-events-none">
            <div className="w-full h-full bg-gradient-to-r from-chili-500 via-rose-500 to-amber-500 animate-pulse" />
          </div>
        )}

        {/* Realtime Order Alert Banner */}
        {activeOrderAlert && (
          <div className="mb-6 animate-in slide-in-from-top-4 duration-300">
            {(() => {
              const isCelebration = Boolean(
                activeOrderAlert.source &&
                  (activeOrderAlert.source.toLowerCase().includes('celebration') ||
                    activeOrderAlert.source.toLowerCase().includes('reservation'))
              );

              return (
                <div
                  className={`p-4 sm:p-5 rounded-3xl text-white shadow-xl border border-white/20 flex flex-col sm:flex-row items-center justify-between gap-4 ${
                    isCelebration
                      ? 'bg-gradient-to-r from-purple-700 via-pink-600 to-rose-600 shadow-purple-600/30'
                      : 'bg-gradient-to-r from-chili-600 via-rose-600 to-amber-600 shadow-chili-600/30'
                  }`}
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0 animate-bounce">
                      {isCelebration ? (
                        <PartyPopper className="w-6 h-6 text-white" />
                      ) : (
                        <BellRing className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-sm sm:text-base tracking-wide">
                          {isCelebration ? '🎉 CELEBRATION BOOKING' : '🔔 NEW ORDER'} #SG-{activeOrderAlert.order_number}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-gray-900 animate-pulse">
                          Pending
                        </span>
                      </div>
                      <p className="text-xs text-white/90 mt-0.5">
                        <strong>{activeOrderAlert.customer_name}</strong> ({activeOrderAlert.customer_phone}) •{' '}
                        {isCelebration ? (
                          <span className="font-semibold">{activeOrderAlert.source}</span>
                        ) : (
                          <>
                            Total: <strong>₹{activeOrderAlert.total}</strong>
                            {activeOrderAlert.items && activeOrderAlert.items.length > 0 && (
                              <span className="opacity-80 ml-1">
                                ({activeOrderAlert.items.length} {activeOrderAlert.items.length === 1 ? 'item' : 'items'})
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => acknowledgeOrder(activeOrderAlert.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold bg-white shadow-md transition-all active:scale-95 cursor-pointer ${
                        isCelebration ? 'text-purple-700 hover:bg-purple-50' : 'text-chili-700 hover:bg-gray-100'
                      }`}
                    >
                      ✓ Mark Handled
                    </button>
                    <button
                      type="button"
                      onClick={dismissOrderAlert}
                      className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      aria-label="Dismiss alert"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {showContentLoader && (
          <div className="w-full animate-in fade-in duration-150">
            <AdminContentLoader activePath={activePath} />
          </div>
        )}
        <div
          style={{ display: showContentLoader ? 'none' : 'block' }}
          className={`transition-opacity duration-150 ${isNavigating ? 'opacity-70' : 'opacity-100'}`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AudioAlertProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AudioAlertProvider>
  );
}
