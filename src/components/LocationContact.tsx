"use client";

import { RESTAURANT_DATA } from "@/data/restaurantData";
import { useCafeOperations } from "@/context/CafeOperationsContext";
import { MapPin, Phone, MessageCircle, Clock, Instagram, ExternalLink, Navigation, AlertCircle } from "lucide-react";

export default function LocationContact() {
  const { status, rawStatus: liveData } = useCafeOperations();

  return (
    <section id="location" className="py-20 bg-gray-50/70 dark:bg-gray-900/50 scroll-mt-20 border-t border-gray-200/60 dark:border-gray-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-12">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-chili-100 dark:bg-chili-950/80 text-chili-700 dark:text-chili-300 border border-chili-200 dark:border-chili-800 mb-2">
            Visit & Contact Us
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            Find Us in {RESTAURANT_DATA.contact.address.street}, {RESTAURANT_DATA.contact.address.locality}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {`Conveniently located in ${RESTAURANT_DATA.contact.address.locality} near ${RESTAURANT_DATA.contact.address.landmark}. Stop by for dining, takeaway, or call ahead for table bookings!`}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Information Column */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Address Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm">
              <div className="flex items-start space-x-3.5">
                <div className="p-3 rounded-2xl bg-chili-50 dark:bg-chili-950/70 text-chili-600 dark:text-chili-400">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white font-serif">
                    Address
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 font-medium">
                    {RESTAURANT_DATA.contact.address.fullAddress}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Landmark: {RESTAURANT_DATA.contact.address.landmark}
                  </p>

                  <a
                    href={RESTAURANT_DATA.contact.geo.directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1.5 mt-3 text-xs font-bold text-chili-600 dark:text-chili-400 hover:underline"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>Get Turn-by-Turn Directions on Google Maps</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Quick Contact Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <a
                href={RESTAURANT_DATA.contact.telLink}
                className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm hover:border-chili-500 transition-colors flex flex-col items-center text-center"
              >
                <div className="w-10 h-10 rounded-full bg-chili-50 dark:bg-chili-950 text-chili-600 dark:text-chili-400 flex items-center justify-center mb-2">
                  <Phone className="w-5 h-5" />
                </div>
                <span className="text-[11px] text-gray-500 uppercase font-semibold">Direct Call</span>
                <span className="text-xs font-bold text-gray-900 dark:text-white mt-0.5">
                  {RESTAURANT_DATA.contact.displayPhone}
                </span>
              </a>

              <a
                href={RESTAURANT_DATA.contact.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm hover:border-emerald-500 transition-colors flex flex-col items-center text-center"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <span className="text-[11px] text-gray-500 uppercase font-semibold">WhatsApp</span>
                <span className="text-xs font-bold text-gray-900 dark:text-white mt-0.5">
                  Chat Now
                </span>
              </a>
            </div>

            {/* Timings Schedule */}
            <div className="p-6 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-garden-600 dark:text-garden-400" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white font-serif">
                    Opening Hours
                  </h3>
                </div>

                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${status.badgeColorClass}`}>
                  {status.statusText}
                </span>
              </div>

              {liveData?.isNoticeActive && liveData?.activeNotice && (
                <div className="mb-4 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200">
                  <div className="flex items-center space-x-1.5 font-bold text-xs text-amber-900 dark:text-amber-100">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span>{liveData.activeNotice.title}</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                    {liveData.activeNotice.message}
                  </p>
                </div>
              )}

              <div className="space-y-1.5 text-xs">
                {!liveData?.operations?.schedule?.length && (
                  <p className="py-2 px-2.5 text-gray-500 dark:text-gray-400">
                    {status.statusText}{status.nextStatusText ? ` – ${status.nextStatusText}` : ''}
                  </p>
                )}
                {(liveData?.operations?.schedule || []).map((item) => {
                  const isToday = status.currentDayName === item.day;
                  const isClosedDay = item.isOpen === false;
                  return (
                    <div
                      key={item.day}
                      className={`flex items-center justify-between py-1.5 px-2.5 rounded-xl transition-colors ${
                        isToday
                          ? "bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-300/60 dark:border-emerald-700/60 font-medium shadow-xs"
                          : "border-b border-gray-100 dark:border-gray-800/80 last:border-0"
                      }`}
                    >
                      <span className="flex items-center space-x-2">
                        <span className={isToday ? "font-bold text-emerald-800 dark:text-emerald-300" : "font-medium text-gray-700 dark:text-gray-300"}>
                          {item.day}
                        </span>
                        {isToday && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold tracking-wide shadow-xs">
                            Today
                          </span>
                        )}
                      </span>
                      <span className={isToday ? "font-bold text-emerald-700 dark:text-emerald-300" : isClosedDay ? "font-semibold text-rose-500" : "font-semibold text-gray-900 dark:text-white"}>
                        {isClosedDay ? "Closed" : `${item.open} – ${item.close}`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {liveData?.operations?.kitchenClosesDisplay && (
                <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-400 italic">
                  {liveData.operations.kitchenClosesDisplay}
                </p>
              )}
            </div>

            {/* Social Link */}
            <a
              href={RESTAURANT_DATA.contact.socials.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-amber-500/10 border border-pink-300/30 dark:border-pink-800/40 hover:opacity-90 transition-opacity"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-pink-600 text-white">
                  <Instagram className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">
                    Follow Our Instagram
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {RESTAURANT_DATA.contact.socials.instagram.handle}
                  </p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-500" />
            </a>

          </div>

          {/* Map Column */}
          <div className="lg:col-span-7 h-[420px] lg:h-[580px] rounded-3xl overflow-hidden border border-gray-200/80 dark:border-gray-800 shadow-md relative">
            <iframe
              title="The Spicy Garden Cafe & Bistro Location Map"
              src={RESTAURANT_DATA.contact.geo.embedMapUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="w-full h-full grayscale-[15%] contrast-[105%]"
            />
            <div className="absolute bottom-4 left-4 right-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">
                  {RESTAURANT_DATA.brand.shortName}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {RESTAURANT_DATA.contact.address.street}, {RESTAURANT_DATA.contact.address.locality}
                </p>
              </div>
              <a
                href={RESTAURANT_DATA.contact.geo.directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-chili-600 text-white hover:bg-chili-700 transition-colors shadow-sm"
              >
                Directions
              </a>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
