"use client";

import React from "react";
import { RESTAURANT_DATA } from "@/data/restaurantData";
import { Phone, MessageCircle, Calendar, Utensils } from "lucide-react";

interface FloatingActionsProps {
  onOpenBooking: (occasion?: string) => void;
}

export default function FloatingActions({ onOpenBooking }: FloatingActionsProps) {
  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 p-2 bg-white/95 dark:bg-gray-950/95 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 shadow-2xl">
      <div className="grid grid-cols-4 gap-1.5 text-center">
        
        {/* Call */}
        <a
          href={RESTAURANT_DATA.contact.telLink}
          className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all"
        >
          <Phone className="w-4 h-4 text-chili-600 mb-0.5" />
          <span>Call</span>
        </a>

        {/* WhatsApp */}
        <a
          href={RESTAURANT_DATA.contact.whatsappLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 active:scale-95 transition-all"
        >
          <MessageCircle className="w-4 h-4 text-emerald-600 mb-0.5" />
          <span>WhatsApp</span>
        </a>

        {/* Menu */}
        <a
          href="#menu"
          className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all"
        >
          <Utensils className="w-4 h-4 text-garden-600 mb-0.5" />
          <span>Menu</span>
        </a>

        {/* Book Table */}
        <button
          onClick={() => onOpenBooking("Table / Party Reservation")}
          type="button"
          className="flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-bold text-white bg-chili-600 hover:bg-chili-700 shadow-sm active:scale-95 transition-all"
        >
          <Calendar className="w-4 h-4 text-white mb-0.5" />
          <span>Book</span>
        </button>

      </div>
    </div>
  );
}
