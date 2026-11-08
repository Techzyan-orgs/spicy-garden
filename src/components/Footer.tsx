"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { RESTAURANT_DATA } from "@/data/restaurantData";
import { MapPin, Phone, Clock, Instagram, Heart, ArrowUp } from "lucide-react";

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="bg-gray-950 text-gray-300 border-t border-gray-800 pt-16 pb-24 sm:pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-gray-800/80">
          
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-chili-600">
                <Image
                  src={RESTAURANT_DATA.assets.logo}
                  alt={RESTAURANT_DATA.brand.name}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
              <div>
                <span className="font-serif font-extrabold text-xl text-white">
                  {RESTAURANT_DATA.brand.name}
                </span>
                <p className="text-xs text-chili-400 font-medium">
                  {RESTAURANT_DATA.brand.tagline}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed max-w-sm">
              {RESTAURANT_DATA.brand.description}
            </p>

            <div className="flex items-center space-x-3 pt-2">
              <a
                href={RESTAURANT_DATA.contact.socials.instagram.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-9 h-9 rounded-full bg-gray-900 hover:bg-pink-600 border border-gray-800 hover:border-pink-500 text-white flex items-center justify-center transition-colors"
              >
                <Instagram className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-serif text-sm font-bold text-white uppercase tracking-wider mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#hero" className="hover:text-chili-400 transition-colors">Home</a></li>
              <li><a href="#menu" className="hover:text-chili-400 transition-colors">Our Menu & Prices</a></li>
              <li><a href="#specialties" className="hover:text-chili-400 transition-colors">Chef's Specials</a></li>
              <li><a href="#occasions" className="hover:text-chili-400 transition-colors">Party Bookings</a></li>
              <li><a href="#gallery" className="hover:text-chili-400 transition-colors">Ambiance & Murals</a></li>
              <li><a href="#reviews" className="hover:text-chili-400 transition-colors">Patron Reviews</a></li>
              <li><a href="#location" className="hover:text-chili-400 transition-colors">Hours & Directions</a></li>
            </ul>
          </div>

          {/* Menu Highlights */}
          <div>
            <h4 className="font-serif text-sm font-bold text-white uppercase tracking-wider mb-4">
              Cuisine Highlights
            </h4>
            <ul className="space-y-2 text-xs text-gray-400">
              <li>Oven Loaded Pizzas (from ₹149)</li>
              <li>Handmade Alfredo & Mix Pastas (from ₹129)</li>
              <li>Double Cheese Gourmet Burgers (from ₹79)</li>
              <li>Tibetan Steamed Momos with Soup (₹99)</li>
              <li>Chilli Garlic & Baked Maggi (from ₹69)</li>
              <li>Triple Decker Club Sandwiches (from ₹69)</li>
              <li>Indo-Chinese Fried Rice Combos (₹199)</li>
            </ul>
          </div>

          {/* NAP Information */}
          <div>
            <h4 className="font-serif text-sm font-bold text-white uppercase tracking-wider mb-4">
              Contact & Hours
            </h4>
            <div className="space-y-3 text-xs text-gray-400">
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 text-chili-500 mt-0.5 flex-shrink-0" />
                <span>{RESTAURANT_DATA.contact.address.fullAddress}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-chili-500 flex-shrink-0" />
                <a href={RESTAURANT_DATA.contact.telLink} className="text-white hover:underline font-bold">
                  {RESTAURANT_DATA.contact.displayPhone}
                </a>
              </div>
              <div className="flex items-start space-x-2">
                <Clock className="w-4 h-4 text-garden-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div>Mon–Thu, Sat–Sun: 2:00 PM – 11:30 PM</div>
                  <div className="text-amber-400 font-medium">Friday: 1:00 PM – 11:00 PM</div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Copyright */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500">
          <p>
            © {new Date().getFullYear()} {RESTAURANT_DATA.brand.name}. All rights reserved.
          </p>
          <div className="flex items-center space-x-4 mt-4 sm:mt-0">
            <span>{RESTAURANT_DATA.contact.address.locality}, {RESTAURANT_DATA.contact.address.city}, {RESTAURANT_DATA.contact.address.state}</span>
            <button
              onClick={scrollToTop}
              className="p-2 rounded-full bg-gray-900 hover:bg-gray-800 text-gray-300 transition-colors"
              aria-label="Back to top"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
}
