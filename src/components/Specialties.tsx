"use client";

import React, { useState } from "react";
import Image from "next/image";
import { RESTAURANT_DATA } from "@/data/restaurantData";
import { useCart } from "@/context/CartContext";
import { Flame, Star, Sparkles, MessageCircle, ArrowRight, X, Plus, Minus, ShoppingBag } from "lucide-react";

interface SpecialtiesProps {
  onOpenBooking: (occasion?: string) => void;
}

interface SpecialItem {
  id: string;
  title: string;
  basePriceDisplay: string;
  hasVegNonVegOptions: boolean;
  vegPrice?: number;
  nonVegPrice?: number;
  priceNumber?: number;
  image: string;
  badge: string;
  description: string;
  rating: string;
}

export default function Specialties({ onOpenBooking }: SpecialtiesProps) {
  const { items: cartItems, addItem, updateQuantity, openCart } = useCart();

  // Track selected dietary preference for items with Veg/Non-Veg options
  const [preferences, setPreferences] = useState<Record<string, "veg" | "non-veg">>({
    "spec-pizza": "veg",
    "spec-momos": "veg",
    "spec-burger": "veg",
  });

  // Modal state for confirming Veg / Non-Veg before redirecting to WhatsApp
  const [pendingSpecial, setPendingSpecial] = useState<SpecialItem | null>(null);

  const specials: SpecialItem[] = [
    {
      id: "spec-pizza",
      title: "TSG Signature Loaded Pizza",
      basePriceDisplay: "₹269 / ₹289",
      hasVegNonVegOptions: true,
      vegPrice: 269,
      nonVegPrice: 289,
      image: RESTAURANT_DATA.assets.heroPizza,
      badge: "Chef's Masterpiece",
      description: "Overloaded with mozzarella, sweet corn, black olives, bell peppers, fresh paneer or roasted chicken chunks seasoned with signature Italian garden spices.",
      rating: "4.9 ★"
    },
    {
      id: "spec-momos",
      title: "Authentic Steamed Momos with Soup",
      basePriceDisplay: "₹99",
      hasVegNonVegOptions: true,
      vegPrice: 99,
      nonVegPrice: 99,
      image: RESTAURANT_DATA.assets.steamedMomos,
      badge: "Tibetan Classic",
      description: "Hand-folded dumplings filled with minced chicken or seasoned greens, served with piping hot clear herbal broth and our famous fiery red chili dip.",
      rating: "4.8 ★"
    },
    {
      id: "spec-chinese",
      title: "Fried Rice & Chilli Chicken Combo",
      basePriceDisplay: "₹199",
      hasVegNonVegOptions: false,
      priceNumber: 199,
      image: RESTAURANT_DATA.assets.chineseSpread,
      badge: "Kolkata Street Style",
      description: "Aromatic long-grain wok-tossed fried rice paired with succulent, glossy chili chicken cubes with bell peppers and spring onions.",
      rating: "4.9 ★"
    },
    {
      id: "spec-burger",
      title: "Handcrafted Grilled Double Burger",
      basePriceDisplay: "₹129 / ₹149",
      hasVegNonVegOptions: true,
      vegPrice: 129,
      nonVegPrice: 149,
      image: RESTAURANT_DATA.assets.burger,
      badge: "Crowd Favorite",
      description: "Golden pan-grilled patty hugged by melted cheese, crisp lettuce, house sweet and tangy sauce, tucked in a warm sesame bun.",
      rating: "4.7 ★"
    },
    {
      id: "spec-tenders",
      title: "Crispy Golden Chicken Tenders",
      basePriceDisplay: "₹149",
      hasVegNonVegOptions: false,
      priceNumber: 149,
      image: RESTAURANT_DATA.assets.chickenTenders,
      badge: "Crunchy Starter",
      description: "Herb-marinated chicken strips breaded and fried to supreme golden crispiness, accompanied by spicy dipping sauce.",
      rating: "4.8 ★"
    }
  ];

  const handleSelectPreference = (id: string, pref: "veg" | "non-veg") => {
    setPreferences((prev) => ({
      ...prev,
      [id]: pref,
    }));
  };

  const redirectToWhatsApp = (spec: SpecialItem, pref?: "veg" | "non-veg") => {
    let dishTitle = spec.title;
    let priceText = spec.basePriceDisplay;

    if (spec.hasVegNonVegOptions) {
      const chosenPref = pref || preferences[spec.id] || "veg";
      const isVeg = chosenPref === "veg";
      const price = isVeg ? spec.vegPrice : spec.nonVegPrice;
      dishTitle = `${spec.title} [${isVeg ? "Vegetarian 🟢" : "Non-Vegetarian / Chicken 🔴"}]`;
      priceText = `₹${price}`;
    }

    const text = `Hi ${RESTAURANT_DATA.brand.shortName}! I would like to order: ${dishTitle} (${priceText}). Please let me know the preparation time and total.`;
    const url = `https://wa.me/${RESTAURANT_DATA.contact.whatsappNumber}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleOrderButtonClick = (spec: SpecialItem) => {
    if (spec.hasVegNonVegOptions) {
      // User can directly order with their chosen toggle preference or open modal
      redirectToWhatsApp(spec, preferences[spec.id]);
    } else {
      redirectToWhatsApp(spec);
    }
  };

  return (
    <section id="specialties" className="py-20 bg-gray-50/70 dark:bg-gray-900/30 scroll-mt-20 border-t border-gray-200/60 dark:border-gray-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-garden-100 dark:bg-garden-950/80 text-garden-800 dark:text-garden-300 border border-garden-200 dark:border-garden-800 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Crowd Pleasers</span>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
              Chef's Signature Creations
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 max-w-xl">
              Hand-picked bestsellers prepared fresh with authentic ingredients and our house secret spice blend.
            </p>
          </div>

          <a
            href="#menu"
            className="mt-4 md:mt-0 inline-flex items-center space-x-2 text-xs font-bold text-chili-600 dark:text-chili-400 hover:text-chili-700 transition-colors"
          >
            <span>See full menu with 60+ dishes</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {specials.map((spec) => {
            const currentPref = preferences[spec.id] || "veg";
            const currentPrice = spec.hasVegNonVegOptions
              ? currentPref === "veg"
                ? `₹${spec.vegPrice}`
                : `₹${spec.nonVegPrice}`
              : spec.basePriceDisplay;

            return (
              <div
                key={spec.id}
                className="rounded-3xl overflow-hidden bg-white dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/60 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
              >
                <div>
                  <div className="relative aspect-[16/10] overflow-hidden bg-gray-100 dark:bg-gray-900">
                    <Image
                      src={spec.image}
                      alt={spec.title}
                      fill
                      loading="lazy"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      placeholder="blur"
                      blurDataURL={RESTAURANT_DATA.assetPlaceholders.default}
                      decoding="async"
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-bold bg-white/90 dark:bg-gray-900/90 text-gray-900 dark:text-white backdrop-blur-md shadow-sm">
                      {spec.badge}
                    </div>
                    <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg text-xs font-bold bg-black/70 text-amber-300 backdrop-blur-md">
                      {spec.rating}
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-serif text-lg font-bold text-gray-900 dark:text-white group-hover:text-chili-600 transition-colors">
                        {spec.title}
                      </h3>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                      {spec.description}
                    </p>

                    {/* Veg / Non-Veg Selector Buttons on the card */}
                    {spec.hasVegNonVegOptions && (
                      <div className="mt-3.5 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                          Select Variant:
                        </span>
                        <div className="flex items-center p-0.5 rounded-xl bg-gray-100 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-xs font-semibold">
                          <button
                            type="button"
                            onClick={() => handleSelectPreference(spec.id, "veg")}
                            className={`px-3 py-1 rounded-lg flex items-center space-x-1.5 transition-all ${
                              currentPref === "veg"
                                ? "bg-emerald-600 text-white shadow-sm font-bold"
                                : "text-gray-600 dark:text-gray-300 hover:text-emerald-600"
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${currentPref === "veg" ? "bg-white" : "bg-emerald-500"}`} />
                            <span>Veg</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSelectPreference(spec.id, "non-veg")}
                            className={`px-3 py-1 rounded-lg flex items-center space-x-1.5 transition-all ${
                              currentPref === "non-veg"
                                ? "bg-rose-600 text-white shadow-sm font-bold"
                                : "text-gray-600 dark:text-gray-300 hover:text-rose-600"
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${currentPref === "non-veg" ? "bg-white" : "bg-rose-500"}`} />
                            <span>Non-Veg</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Price & Order CTA Row */}
                <div className="p-5 pt-0 flex items-center justify-between border-t border-gray-100 dark:border-gray-700/60 mt-2">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-gray-400">
                      {spec.hasVegNonVegOptions ? (currentPref === "veg" ? "Veg Price" : "Non-Veg Price") : "Price"}
                    </span>
                    <p className="text-base font-extrabold text-chili-600 dark:text-chili-400 font-sans">
                      {currentPrice}
                    </p>
                  </div>

                  {(() => {
                    const isVeg = spec.hasVegNonVegOptions ? currentPref === "veg" : !spec.id.includes("chicken") && !spec.id.includes("tenders");
                    const pref = spec.hasVegNonVegOptions ? currentPref : undefined;
                    const compositeId = `${spec.id}_${pref || "standard"}`;
                    const inCartItem = cartItems.find((i) => i.id === compositeId || (i.itemId === spec.id && i.variant === pref));
                    const inCartQty = inCartItem?.quantity || 0;

                    return inCartQty > 0 ? (
                      <div className="flex items-center space-x-1 p-0.5 rounded-xl bg-chili-50 dark:bg-chili-950/70 border border-chili-300 dark:border-chili-800 shadow-xs">
                        <button
                          type="button"
                          onClick={() => updateQuantity(inCartItem!.id, -1)}
                          className="w-7 h-7 rounded-lg bg-white dark:bg-gray-800 text-chili-600 hover:bg-chili-100 dark:hover:bg-chili-900/60 flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
                          title={inCartQty === 1 ? "Remove from tray" : "Decrease quantity"}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-extrabold text-xs text-chili-800 dark:text-chili-200 px-2 min-w-[20px] text-center font-sans">
                          {inCartQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(inCartItem!.id, 1)}
                          disabled={inCartQty >= 20}
                          className="w-7 h-7 rounded-lg bg-chili-600 text-white hover:bg-chili-700 flex items-center justify-center font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                          title="Add more"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          const price = spec.hasVegNonVegOptions
                            ? currentPref === "veg"
                              ? spec.vegPrice!
                              : spec.nonVegPrice!
                            : spec.priceNumber!;
                          addItem(
                            {
                              id: spec.id,
                              name: spec.title,
                              price,
                              isVeg,
                              image: spec.image,
                            },
                            pref,
                            1
                          );
                        }}
                        type="button"
                        className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-chili-600 hover:bg-chili-700 active:scale-95 transition-all shadow-sm shadow-chili-600/20 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to Order</span>
                      </button>
                    );
                  })()}
                </div>

              </div>
            );
          })}
        </div>

      </div>

      {/* Veg / Non-Veg Preference Modal */}
      {pendingSpecial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative bg-white dark:bg-gray-900 rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-5">
            <button
              onClick={() => setPendingSpecial(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close preference modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300/40 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Preference Required</span>
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Choose Veg or Non-Veg
              </h3>
              <p className="text-sm font-semibold text-chili-600 dark:text-chili-400 mt-1">
                {pendingSpecial.title}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                Please select whether you would like this specialty prepared as Vegetarian or Non-Vegetarian:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleSelectPreference(pendingSpecial.id, "veg")}
                className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between transition-all cursor-pointer ${
                  (preferences[pendingSpecial.id] || "veg") === "veg"
                    ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 shadow-sm ring-2 ring-emerald-500/20"
                    : "border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-4 h-4 rounded-sm border border-emerald-600 flex items-center justify-center p-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    </span>
                    {(preferences[pendingSpecial.id] || "veg") === "veg" && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                    Vegetarian (Veg)
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-tight">
                    Pure veg preparation with fresh vegetables, paneer &amp; mozzarella
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-emerald-200/40 dark:border-emerald-800/40 flex items-baseline justify-between">
                  <span className="text-[10px] text-gray-400 uppercase">Price:</span>
                  <span className="font-bold text-base text-gray-900 dark:text-white font-sans">
                    ₹{pendingSpecial.vegPrice}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreference(pendingSpecial.id, "non-veg")}
                className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between transition-all cursor-pointer ${
                  (preferences[pendingSpecial.id] || "veg") === "non-veg"
                    ? "border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 shadow-sm ring-2 ring-rose-500/20"
                    : "border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-4 h-4 rounded-sm border border-rose-600 flex items-center justify-center p-0.5">
                      <span className="w-2 h-2 rounded-full bg-rose-600" />
                    </span>
                    {(preferences[pendingSpecial.id] || "veg") === "non-veg" && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                    Non-Veg / Chicken
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-tight">
                    Tender spiced chicken &amp; succulent non-veg preparation
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-rose-200/40 dark:border-rose-800/40 flex items-baseline justify-between">
                  <span className="text-[10px] text-gray-400 uppercase">Price:</span>
                  <span className="font-bold text-base text-rose-600 dark:text-rose-400 font-sans">
                    ₹{pendingSpecial.nonVegPrice}
                  </span>
                </div>
              </button>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPendingSpecial(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingSpecial) {
                    const pref = preferences[pendingSpecial.id] || "veg";
                    const price = pref === "veg" ? pendingSpecial.vegPrice! : pendingSpecial.nonVegPrice!;
                    addItem(
                      {
                        id: pendingSpecial.id,
                        name: pendingSpecial.title,
                        price,
                        isVeg: pref === "veg",
                        image: pendingSpecial.image,
                      },
                      pref,
                      1
                    );
                    setPendingSpecial(null);
                  }
                }}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-chili-600 hover:bg-chili-700 active:scale-95 transition-all shadow-md shadow-chili-600/25 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add to Order Tray</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingSpecial) {
                    redirectToWhatsApp(pendingSpecial, preferences[pendingSpecial.id]);
                    setPendingSpecial(null);
                  }
                }}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 active:scale-95 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp Order</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
