"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { RESTAURANT_DATA } from "@/data/restaurantData";
import ThemeToggle from "./ThemeToggle";
import { Phone, MessageCircle, Menu, X, Calendar, MapPin, Clock, Sparkles, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useCafeOperations } from "@/context/CafeOperationsContext";
import NoticeBanner from "./NoticeBanner";

interface NavbarProps {
  onOpenBooking: (occasion?: string) => void;
}

export default function Navbar({ onOpenBooking }: NavbarProps) {
  const { totalItems, openCart, justAddedId } = useCart();
  const { status } = useCafeOperations();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { label: "Menu", href: "#menu" },
    { label: "Specials", href: "#specialties" },
    { label: "Celebrations", href: "#occasions" },
    { label: "Contact", href: "#location" },
  ];

  const allMobileLinks = [
    { label: "Home", href: "#hero" },
    { label: "Menu", href: "#menu" },
    { label: "Chef's Specials", href: "#specialties" },
    { label: "Party Celebrations", href: "#occasions" },
    { label: "Ambiance & Murals", href: "#gallery" },
    { label: "Reviews", href: "#reviews" },
    { label: "Location & Hours", href: "#location" },
  ];

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  const toggleMobileMenu = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (e.type === "touchend") {
      e.preventDefault();
    }
    setMobileMenuOpen((prev) => !prev);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay (full screen click outside to dismiss) */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          onTouchEnd={(e) => {
            e.preventDefault();
            setMobileMenuOpen(false);
          }}
          aria-hidden="true"
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-40 cursor-pointer"
        />
      )}

      <header
        className={`fixed top-0 left-0 right-0 w-full max-w-full z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/95 dark:bg-gray-950/95 backdrop-blur-md shadow-md py-2 sm:py-2.5 border-b border-gray-200/50 dark:border-gray-800/60"
          : "bg-white/90 dark:bg-gray-950/90 backdrop-blur-sm py-2.5 sm:py-3.5 border-b border-transparent"
      }`}
    >
      {/* Dynamic Announcement & Closure Notice Banner */}
      <NoticeBanner />

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full">
        <div className="flex items-center justify-between gap-2 sm:gap-4 w-full min-w-0">
          {/* Brand Logo & Name */}
          <Link
            href="#hero"
            className="flex items-center space-x-2 sm:space-x-3 group focus:outline-none min-w-0 flex-shrink"
            aria-label={RESTAURANT_DATA.brand.name}
          >
            <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-full overflow-hidden border-2 border-chili-600/40 shadow-md group-hover:scale-105 transition-transform flex-shrink-0">
              <Image
                src={RESTAURANT_DATA.assets.logo}
                alt={RESTAURANT_DATA.brand.name}
                fill
                sizes="(max-width: 640px) 36px, 44px"
                className="object-cover"
                priority
              />
            </div>
            <div className="min-w-0 flex flex-col justify-center">
              <span className="font-serif font-extrabold text-base sm:text-xl tracking-tight text-gray-900 dark:text-white group-hover:text-chili-600 dark:group-hover:text-chili-400 transition-colors leading-tight truncate block">
                {RESTAURANT_DATA.brand.shortName}
              </span>
              <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-chili-600 dark:text-chili-400 font-sans block leading-none mt-0.5">
                Café &amp; Bistro
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1 xl:space-x-4 flex-shrink-0" aria-label="Main Navigation">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-chili-600 dark:hover:text-chili-400 hover:bg-gray-100/70 dark:hover:bg-gray-800/60 rounded-lg transition-colors whitespace-nowrap"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right Action Cluster */}
          <div className="flex items-center space-x-1.5 sm:space-x-2.5 flex-shrink-0">
            {/* Cart Button with Live Animated Badge */}
            <button
              onClick={openCart}
              type="button"
              className="relative p-2 rounded-xl text-gray-700 dark:text-gray-200 hover:text-chili-600 dark:hover:text-chili-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all flex items-center justify-center cursor-pointer active:scale-95"
              title={`View Order Tray (${totalItems} items)`}
              aria-label="View Order Tray"
            >
              <ShoppingBag className="w-5 h-5" />
              {totalItems > 0 && (
                <span
                  className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black bg-chili-600 text-white flex items-center justify-center shadow-xs transition-transform ${
                    justAddedId ? 'scale-125' : 'scale-100'
                  }`}
                >
                  {totalItems}
                </span>
              )}
            </button>

            {/* Book Celebration / Table CTA (Visible on tablets & desktop, hidden on small mobile) */}
            <button
              onClick={() => onOpenBooking()}
              type="button"
              className="hidden sm:inline-flex items-center space-x-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold text-white bg-chili-600 hover:bg-chili-700 active:scale-95 transition-all shadow-sm shadow-chili-600/30 flex-shrink-0"
            >
              <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="whitespace-nowrap">Book Table</span>
            </button>

            {/* Theme Toggle */}
            <div className="flex-shrink-0">
              <ThemeToggle />
            </div>

            {/* Mobile / Tablet Menu Button */}
            <button
              onClick={toggleMobileMenu}
              onTouchEnd={toggleMobileMenu}
              type="button"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              className="lg:hidden min-w-[44px] min-h-[44px] w-11 h-11 p-2.5 rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-chili-500 flex-shrink-0 border border-gray-200/60 dark:border-gray-800 flex items-center justify-center cursor-pointer touch-manipulation select-none relative z-50"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 flex-shrink-0 pointer-events-none" />
              ) : (
                <Menu className="w-6 h-6 flex-shrink-0 pointer-events-none" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-4 pt-3 pb-6 shadow-2xl space-y-3 animate-in slide-in-from-top duration-200 max-h-[calc(100vh-4.5rem)] overflow-y-auto relative z-20">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs">
            <span className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full ${status.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="font-medium text-gray-800 dark:text-gray-200">{status.statusText}</span>
            </span>
            <span className="text-gray-500 dark:text-gray-400">{status.nextStatusText}</span>
          </div>

          <div className="grid grid-cols-1 gap-1">
            {allMobileLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={handleNavClick}
                className="px-3 py-2.5 text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-chili-600 dark:hover:text-chili-400 hover:bg-gray-100 dark:hover:bg-gray-900 rounded-lg transition-colors block"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="pt-2 border-t border-gray-200 dark:border-gray-800 grid grid-cols-2 gap-2">
            <a
              href={RESTAURANT_DATA.contact.telLink}
              className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
            >
              <Phone className="w-3.5 h-3.5 text-chili-600" />
              <span>Call Cafe</span>
            </a>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenBooking();
              }}
              className="flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold bg-chili-600 text-white shadow-sm"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Book Table</span>
            </button>
          </div>
        </div>
      )}
    </header>
    </>
  );
}
