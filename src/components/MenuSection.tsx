"use client";

import React, { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { RESTAURANT_DATA, PrintedMenuPage } from "@/data/restaurantData";
import { useMenuData, ExtendedMenuItem } from "@/hooks/useMenuData";
import { useCart } from "@/context/CartContext";
import dynamic from "next/dynamic";

const OrderModal = dynamic(() => import("./OrderModal"), {
  ssr: false,
});
import { trackEvent } from "@/lib/analytics";
import {
  Search,
  Flame,
  Sparkles,
  MessageCircle,
  X,
  ChevronRight,
  ChevronLeft,
  Eye,
  Download,
  ChevronDown,
  ChevronUp,
  Plus,
  Minus,
  ShoppingBag,
  ZoomIn,
  ZoomOut,
  BookOpen,
} from "lucide-react";

// Dishes that legitimately support dual Veg / Non-Veg preparation options
const DUAL_OPTION_DISH_IDS = new Set([
  "pas-1", // White Sauce Pasta (Alfredo Style)
  "pas-2", // Red Sauce Pasta (Arrabbiata Style)
  "pas-3", // Mix Sauce Pasta (Pink Sauce Rosa)
  "pas-4", // TSG's Special Baked Pasta
  "piz-5", // Cheese Burst Pizza
  "piz-6", // Paneer / Chicken Tikka Pizza
  "mag-8", // TSG's Special Baked Maggi
  "san-14", // Bombay Club Sandwich
  "san-15", // American Club Sandwich
]);

// Helper to determine if dish requires Veg / Non-Veg preference prompt
function requiresDietarySelection(item: ExtendedMenuItem): boolean {
  // 1. Explicitly dual-priced items
  if (Boolean(item.chickenPrice) || DUAL_OPTION_DISH_IDS.has(item.id)) {
    return true;
  }

  // 2. Explicit dual mention in dish title (e.g. combo platter offering both options)
  const lower = item.name.toLowerCase();
  if (
    lower.includes("veg") &&
    (lower.includes("chicken") || lower.includes("non-veg") || lower.includes("non veg"))
  ) {
    return true;
  }

  // All other dishes (beverages, parathas, salads, pure veg starters, paneer, mushroom, shakes, etc.) are single-variant items
  return false;
}

function getDietaryPricing(item: ExtendedMenuItem): { vegPrice: number; nonVegPrice: number } {
  const vegPrice = item.price;
  let nonVegPrice = item.chickenPrice || item.price;

  if (item.id === "piz-5") nonVegPrice = 259;
  else if (item.id === "piz-6") nonVegPrice = 219;
  else if (item.id === "mag-8") nonVegPrice = 169;
  else if (item.id === "san-14" || item.id === "san-15") nonVegPrice = item.price + 20;

  return { vegPrice, nonVegPrice };
}

// Reusable Dish Card Component with Multi-Item Cart Integration
function DishCard({
  item,
  onAddWithOptions,
}: {
  item: ExtendedMenuItem;
  onAddWithOptions: (item: ExtendedMenuItem) => void;
}) {
  const { items: cartItems, addItem, updateQuantity } = useCart();
  const isAvailable = item.isAvailable !== false;
  const dishImage = item.image || item.image_url;
  const hasOptions = requiresDietarySelection(item);

  // If dish has options (e.g. veg or chicken prices)
  const cartMatches = cartItems.filter((i) => i.itemId === item.id);
  const totalInCart = cartMatches.reduce((sum, i) => sum + i.quantity, 0);

  // If dish has no options, there is at most 1 cartItem entry
  const singleCartItem = !hasOptions ? cartMatches[0] : undefined;
  const singleQty = singleCartItem?.quantity || 0;

  return (
    <div
      onClick={() => trackEvent("menu_item_view", { itemId: item.id, category: item.category })}
      className={`flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-white dark:bg-gray-900/90 border border-gray-200/80 dark:border-gray-800/80 shadow-sm transition-all group ${
        isAvailable
          ? "hover:shadow-md hover:border-chili-500/40 dark:hover:border-chili-500/40"
          : "opacity-75 bg-gray-50/80 dark:bg-gray-950/60"
      }`}
    >
      <div>
        {/* Dish Photo Banner */}
        {dishImage && (
          <div className="relative w-full h-40 sm:h-44 rounded-xl overflow-hidden mb-3.5 bg-gray-100 dark:bg-gray-800/80 flex-shrink-0 border border-gray-100 dark:border-gray-800">
            <Image
              src={dishImage}
              alt={item.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-25 group-hover:opacity-10 transition-opacity pointer-events-none" />
          </div>
        )}

        {/* Top Tags & Dietary Indicator */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
            {/* Veg / Non-Veg Dot in Square */}
            <span
              className={`w-4 h-4 rounded-sm border flex items-center justify-center p-0.5 ${
                item.isVeg ? "border-emerald-600" : "border-rose-600"
              }`}
              title={item.isVeg ? "Vegetarian" : "Non-Vegetarian"}
            >
              <span className={`w-2 h-2 rounded-full ${item.isVeg ? "bg-emerald-600" : "bg-rose-600"}`} />
            </span>

            {item.isBestSeller && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300/40">
                Bestseller
              </span>
            )}

            {item.isSpecial && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-chili-100 dark:bg-chili-950/70 text-chili-700 dark:text-chili-300 border border-chili-300/40">
                TSG Special
              </span>
            )}

            {!isAvailable && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700">
                Sold Out
              </span>
            )}
          </div>

          {item.isSpicy && (
            <span
              className="flex items-center space-x-0.5 text-[11px] font-medium text-chili-600 dark:text-chili-400"
              title="Spicy Dish"
            >
              <Flame className="w-3.5 h-3.5 fill-chili-500" />
              <span>Spicy</span>
            </span>
          )}
        </div>

        {/* Dish Name */}
        <h4 className="font-serif text-base sm:text-lg font-bold text-gray-900 dark:text-white group-hover:text-chili-600 dark:group-hover:text-chili-400 transition-colors">
          {item.name}
        </h4>

        {/* Description */}
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">
          {item.description}
        </p>
      </div>

      {/* Bottom Row: Price & Multi-Item Add Action */}
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
        {/* Price display */}
        <div>
          {item.chickenPrice ? (
            <div className="flex items-center space-x-2 text-xs">
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-[10px]">Veg: </span>
                <span className="font-bold text-gray-900 dark:text-white font-sans text-sm">₹{item.price}</span>
              </div>
              <span className="text-gray-300 dark:text-gray-700">|</span>
              <div>
                <span className="text-gray-500 dark:text-gray-400 text-[10px]">Chicken: </span>
                <span className="font-bold text-rose-600 dark:text-rose-400 font-sans text-sm">₹{item.chickenPrice}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-baseline space-x-1">
              <span className="text-xl font-extrabold text-gray-900 dark:text-white font-sans">
                ₹{item.price}
              </span>
            </div>
          )}
        </div>

        {/* Order / Add to Cart Action */}
        {isAvailable ? (
          hasOptions ? (
            // Dish with dietary options (Veg vs Chicken)
            <button
              onClick={() => onAddWithOptions(item)}
              type="button"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs ${
                totalInCart > 0
                  ? "bg-chili-600 text-white hover:bg-chili-700 shadow-chili-600/20"
                  : "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800"
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{totalInCart > 0 ? `Added (${totalInCart}) +` : "Add"}</span>
            </button>
          ) : singleQty > 0 ? (
            // Single variant dish already in cart: show inline stepper!
            <div className="flex items-center space-x-1 p-0.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 shadow-xs">
              <button
                type="button"
                onClick={() => updateQuantity(singleCartItem!.id, -1)}
                className="w-6 h-6 rounded-lg bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 flex items-center justify-center font-bold text-xs transition-colors cursor-pointer"
                title={singleQty === 1 ? "Remove from tray" : "Decrease quantity"}
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-extrabold text-xs text-emerald-800 dark:text-emerald-200 px-1.5 min-w-[18px] text-center font-sans">
                {singleQty}
              </span>
              <button
                type="button"
                onClick={() => updateQuantity(singleCartItem!.id, 1)}
                disabled={singleQty >= 20}
                className="w-6 h-6 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center font-bold text-xs transition-colors disabled:opacity-50 cursor-pointer"
                title="Add more"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            // Single variant dish not yet in cart: show Add button!
            <button
              onClick={() => addItem(item, item.isVeg ? "veg" : "non-veg", 1)}
              type="button"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition-all active:scale-95 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          )
        ) : (
          <span className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-not-allowed">
            Unavailable
          </span>
        )}
      </div>
    </div>
  );
}

export default function MenuSection() {
  const { categories, items, isLoading: isMenuLoading, error: menuError, refetch: refetchMenu } = useMenuData();
  const { isCartOpen, closeCart, openCart, addItem } = useCart();

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [dietaryFilter, setDietaryFilter] = useState<"all" | "veg" | "non-veg">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showFullMenuModal, setShowFullMenuModal] = useState<boolean>(false);
  const [activeMenuPage, setActiveMenuPage] = useState<number>(0);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);

  const printedPages: PrintedMenuPage[] = useMemo(() => {
    return RESTAURANT_DATA.assets.menuPages || [];
  }, []);

  // Keyboard navigation for multi-page menu viewer
  useEffect(() => {
    if (!showFullMenuModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowFullMenuModal(false);
      } else if (e.key === "ArrowLeft") {
        setActiveMenuPage((prev) => (prev > 0 ? prev - 1 : printedPages.length - 1));
      } else if (e.key === "ArrowRight") {
        setActiveMenuPage((prev) => (prev < printedPages.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showFullMenuModal, printedPages.length]);

  // Tracks which category cards are currently open in "All Items" view
  const [openCategoryIds, setOpenCategoryIds] = useState<string[]>(["pizza"]);

  // Tracks pending item requiring Veg / Non-Veg confirmation
  const [pendingOrderItem, setPendingOrderItem] = useState<ExtendedMenuItem | null>(null);
  const [selectedPreference, setSelectedPreference] = useState<"veg" | "non-veg">("veg");

  const actualCategories = useMemo(() => {
    return categories.filter((c) => c.id !== "all");
  }, [categories]);

  // Toggle single category in "All Items" view
  const toggleCategory = (catId: string) => {
    setOpenCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
    trackEvent("category_viewed", { categoryId: catId });
  };

  const expandAllCategories = () => {
    setOpenCategoryIds(actualCategories.map((c) => c.id));
  };

  const collapseAllCategories = () => {
    setOpenCategoryIds([]);
  };

  const handleCategoryPillClick = (catId: string) => {
    setActiveCategory(catId);
    if (catId !== "all") {
      if (!openCategoryIds.includes(catId)) {
        setOpenCategoryIds((prev) => [...prev, catId]);
      }
      trackEvent("category_viewed", { categoryId: catId });
    }
  };

  const handleDietaryChange = (filter: "all" | "veg" | "non-veg") => {
    setDietaryFilter(filter);
  };

  // Open dietary options modal for customizable items
  const handleAddWithOptions = (item: ExtendedMenuItem) => {
    trackEvent("menu_item_customize", { itemId: item.id, name: item.name });
    setPendingOrderItem(item);
    setSelectedPreference(item.isVeg ? "veg" : "non-veg");
  };

  // Filter items based on dietary and search query
  const getMatchingItemsForCategory = (catId: string) => {
    return items.filter((item) => {
      if (item.category !== catId) return false;

      const matchDiet =
        dietaryFilter === "all" ||
        (dietaryFilter === "veg" && item.isVeg) ||
        (dietaryFilter === "non-veg" && !item.isVeg);

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.tags && item.tags.some((t) => t.toLowerCase().includes(q)));

      return matchDiet && matchSearch;
    });
  };

  // Total matching items across whole menu
  const totalMatchingItemsCount = useMemo(() => {
    return items.filter((item) => {
      const matchCategory = activeCategory === "all" || item.category === activeCategory;
      const matchDiet =
        dietaryFilter === "all" ||
        (dietaryFilter === "veg" && item.isVeg) ||
        (dietaryFilter === "non-veg" && !item.isVeg);

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.tags && item.tags.some((t) => t.toLowerCase().includes(q)));

      return matchCategory && matchDiet && matchSearch;
    }).length;
  }, [activeCategory, dietaryFilter, searchQuery, items]);

  return (
    <section id="menu" className="py-20 bg-white dark:bg-gray-950 scroll-mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-chili-100 dark:bg-chili-950/80 text-chili-700 dark:text-chili-300 border border-chili-200 dark:border-chili-800 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Authentic Menu & Genuine Prices</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
            Explore Our Delicious Menu
          </h2>
          <p className="mt-3 text-sm sm:text-base text-gray-600 dark:text-gray-300">
            From artisanal oven-fired pizzas and creamy pastas to hearty double cheese burgers, comforting Maggi, and sizzling Chinese platters.
          </p>
          
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                setActiveMenuPage(0);
                setIsZoomed(false);
                setShowFullMenuModal(true);
                trackEvent("menu_opened", { type: "printed_card_header" });
              }}
              type="button"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-chili-600 hover:bg-chili-700 text-white transition-all shadow-md shadow-chili-600/20 active:scale-95 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>View Full Printed Menu</span>
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 text-white font-mono">
                {printedPages.length} Pages
              </span>
            </button>

            <a
              href={printedPages[0]?.image || RESTAURANT_DATA.assets.menuCardWebp}
              download={printedPages[0]?.downloadName || "Spicy_Garden_Menu.webp"}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4 text-chili-600 dark:text-chili-400" />
              <span>Download Menu Cards</span>
            </a>
          </div>
        </div>

        {/* Printed Menu Teaser Banner - All 4 Pages Showcase */}
        <div className="mb-10 p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-amber-500/10 via-chili-500/10 to-rose-500/10 border border-amber-300/50 dark:border-amber-700/40 shadow-sm">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            
            {/* Left: 4 Visual Page Thumbnails with Badges */}
            <div className="flex items-center justify-center space-x-2.5 sm:space-x-3 overflow-x-auto pb-1 max-w-full">
              {printedPages.map((page, idx) => (
                <div
                  key={page.pageNumber}
                  onClick={() => {
                    setActiveMenuPage(idx);
                    setIsZoomed(false);
                    setShowFullMenuModal(true);
                    trackEvent("menu_opened", { type: `printed_card_thumb_p${page.pageNumber}` });
                  }}
                  className="group relative flex flex-col items-center cursor-pointer flex-shrink-0"
                >
                  <div className="relative w-16 h-24 sm:w-20 sm:h-28 rounded-xl overflow-hidden border-2 border-amber-400/60 dark:border-amber-600/50 shadow-md group-hover:scale-105 group-hover:border-chili-500 group-hover:shadow-lg transition-all duration-300 bg-gray-900">
                    <Image
                      src={page.image}
                      alt={page.title}
                      fill
                      sizes="80px"
                      className="object-cover group-hover:opacity-90 transition-opacity"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <span className="absolute bottom-1 left-1 right-1 text-center text-[10px] font-bold text-white uppercase tracking-wider bg-black/70 backdrop-blur-xs py-0.5 rounded">
                      Page {page.pageNumber}
                    </span>
                  </div>
                  <span className="mt-1 text-[11px] font-semibold text-gray-700 dark:text-gray-300 group-hover:text-chili-600 dark:group-hover:text-chili-400 text-center max-w-[80px] truncate">
                    {page.tag}
                  </span>
                </div>
              ))}
            </div>

            {/* Center: Info & Quick Page Jumper */}
            <div className="flex-1 text-center lg:text-left space-y-2">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/50">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Official Printed Menu Cards (4 High-Res Pages)</span>
              </div>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white font-serif">
                Prefer browsing our printed menu cards?
              </h4>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 max-w-2xl">
                Browse all 4 authentic physical menu pages exactly as printed in our cafe — covering Fast Food, Starters, Momos, Chinese Main Course, Wok Rice, Noodles &amp; Beverages.
              </p>

              {/* Quick page jumper pills */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-1.5 pt-1">
                {printedPages.map((page, idx) => (
                  <button
                    key={page.pageNumber}
                    type="button"
                    onClick={() => {
                      setActiveMenuPage(idx);
                      setIsZoomed(false);
                      setShowFullMenuModal(true);
                      trackEvent("menu_opened", { type: `printed_card_pill_p${page.pageNumber}` });
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/80 dark:bg-gray-800/80 hover:bg-chili-50 dark:hover:bg-chili-950/40 text-gray-700 dark:text-gray-200 hover:text-chili-600 dark:hover:text-chili-400 border border-gray-200/80 dark:border-gray-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    P{page.pageNumber}: {page.tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Open Viewer Button */}
            <div className="flex-shrink-0">
              <button
                onClick={() => {
                  setActiveMenuPage(0);
                  setIsZoomed(false);
                  setShowFullMenuModal(true);
                  trackEvent("menu_opened", { type: "printed_card_button" });
                }}
                type="button"
                className="px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold text-white bg-chili-600 hover:bg-chili-700 active:scale-95 transition-all shadow-md shadow-chili-600/25 flex items-center space-x-2 cursor-pointer"
              >
                <span>Open 4-Page Viewer</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>

        {/* Filters Bar */}
        <div className="space-y-4 mb-8">
          
          {/* Search Bar & Veg/Non-Veg Switch */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pizzas, burgers, momos, pasta..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-chili-500 text-gray-900 dark:text-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dietary Toggle Buttons */}
            <div className="flex items-center p-1 rounded-xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-xs font-semibold self-stretch sm:self-auto justify-center">
              <button
                type="button"
                onClick={() => handleDietaryChange("all")}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  dietaryFilter === "all"
                    ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                All ({items.length})
              </button>

              <button
                type="button"
                onClick={() => handleDietaryChange("veg")}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
                  dietaryFilter === "veg"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-emerald-600"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Veg Only</span>
              </button>

              <button
                type="button"
                onClick={() => handleDietaryChange("non-veg")}
                className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-all ${
                  dietaryFilter === "non-veg"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-rose-600"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span>Non-Veg</span>
              </button>
            </div>

          </div>

          {/* Live menu loading / unavailable states (no built-in fallback menu) */}
          {items.length === 0 && isMenuLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-busy="true" aria-label="Loading menu">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 rounded-2xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse" />
              ))}
            </div>
          )}
          {items.length === 0 && !isMenuLoading && menuError && (
            <div role="alert" className="p-5 rounded-2xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 text-center space-y-2">
              <p className="font-bold text-amber-900 dark:text-amber-200">{menuError}</p>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90">
                We&apos;re retrying automatically. To order right now, call us at{" "}
                <a href={RESTAURANT_DATA.contact.telLink} className="font-bold underline">
                  {RESTAURANT_DATA.contact.displayPhone}
                </a>
                .
              </p>
              <button
                type="button"
                onClick={() => refetchMenu()}
                className="mt-1 px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white"
              >
                Try again
              </button>
            </div>
          )}

          {/* Category Pills Slider */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar">
            {categories.map((cat) => {
              const count =
                cat.id === "all"
                  ? items.length
                  : items.filter((i) => i.category === cat.id).length;

              const isActive = activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryPillClick(cat.id)}
                  type="button"
                  className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all border ${
                    isActive
                      ? "bg-chili-600 text-white border-chili-600 shadow-md shadow-chili-600/25"
                      : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:border-chili-500/50 hover:bg-gray-50 dark:hover:bg-gray-800/80"
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      isActive
                        ? "bg-white/25 text-white"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

        </div>

        {/* CASE A: "All Items" Selected */}
        {activeCategory === "all" ? (
          <div className="space-y-6">
            
            {/* Multi-Open Control Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-800 text-xs">
              <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                <Sparkles className="w-4 h-4 text-chili-600 dark:text-chili-400 flex-shrink-0" />
                <span className="font-semibold text-gray-900 dark:text-white">Interactive Category Cards:</span>
                <span>Click any category card to open/close its dishes</span>
              </div>
              <div className="flex items-center space-x-2 self-stretch sm:self-auto justify-end">
                <button
                  onClick={expandAllCategories}
                  type="button"
                  className="px-3.5 py-1.5 rounded-xl font-semibold text-xs text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-colors shadow-sm"
                >
                  Expand All ({actualCategories.length})
                </button>
                <button
                  onClick={collapseAllCategories}
                  type="button"
                  className="px-3.5 py-1.5 rounded-xl font-semibold text-xs text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-colors shadow-sm"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {/* List of Category Cards */}
            <div className="space-y-5">
              {actualCategories.map((cat) => {
                const matchingItems = getMatchingItemsForCategory(cat.id);
                const allCatItems = items.filter((i) => i.category === cat.id);
                const minPrice =
                  allCatItems.length > 0 ? Math.min(...allCatItems.map((i) => i.price)) : 0;
                const vegCount = allCatItems.filter((i) => i.isVeg).length;
                const nonVegCount = allCatItems.filter((i) => !i.isVeg).length;

                const isAutoExpanded = searchQuery.trim().length > 0 && matchingItems.length > 0;
                const isOpen = isAutoExpanded || openCategoryIds.includes(cat.id);

                return (
                  <div
                    key={cat.id}
                    className={`rounded-3xl border transition-all duration-300 overflow-hidden ${
                      isOpen
                        ? "bg-white dark:bg-gray-900/95 border-chili-500/40 dark:border-chili-500/40 shadow-lg shadow-chili-600/5 ring-1 ring-chili-500/20"
                        : "bg-white/90 dark:bg-gray-900/60 border-gray-200/80 dark:border-gray-800/80 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      aria-expanded={isOpen}
                      className="w-full text-left p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 focus:outline-none group cursor-pointer"
                    >
                      <div className="flex items-start sm:items-center space-x-4">
                        {cat.image && (
                          <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden flex-shrink-0 border border-gray-200/80 dark:border-gray-800 shadow-sm group-hover:scale-105 transition-transform duration-300">
                            <Image
                              src={cat.image}
                              alt={cat.label}
                              fill
                              sizes="(max-width: 640px) 64px, 80px"
                              className="object-cover"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                          </div>
                        )}

                        <div className="space-y-1 sm:space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                            <h3 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 dark:text-white group-hover:text-chili-600 dark:group-hover:text-chili-400 transition-colors">
                              {cat.label}
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-chili-100 dark:bg-chili-950/80 text-chili-700 dark:text-chili-300 border border-chili-200 dark:border-chili-800">
                              {matchingItems.length} {matchingItems.length === 1 ? "Dish" : "Dishes"}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300/40">
                              Starting at ₹{minPrice}
                            </span>
                          </div>

                          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                            {cat.description}
                          </p>

                          <div className="flex items-center space-x-3 text-xs pt-0.5 text-gray-500 dark:text-gray-400">
                            {vegCount > 0 && (
                              <span className="flex items-center space-x-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span>{vegCount} Veg</span>
                              </span>
                            )}
                            {nonVegCount > 0 && (
                              <span className="flex items-center space-x-1">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                <span>{nonVegCount} Non-Veg</span>
                              </span>
                            )}
                            <span className="text-gray-300 dark:text-gray-700">•</span>
                            <span className="text-chili-600 dark:text-chili-400 font-medium">
                              {isOpen ? "Click to collapse" : "Click to view all dishes"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end sm:justify-center self-end sm:self-center">
                        <span
                          className={`inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                            isOpen
                              ? "bg-chili-600 text-white shadow-chili-600/25"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 group-hover:bg-chili-50 dark:group-hover:bg-chili-950/40 group-hover:text-chili-600 dark:group-hover:text-chili-400 border border-gray-200 dark:border-gray-700"
                          }`}
                        >
                          <span>{isOpen ? "Hide Dishes" : `View Dishes (${matchingItems.length})`}</span>
                          {isOpen ? (
                            <ChevronUp className="w-4 h-4 transition-transform" />
                          ) : (
                            <ChevronDown className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
                          )}
                        </span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-6 sm:px-6 sm:pb-6 pt-2 border-t border-gray-100 dark:border-gray-800/80 animate-in fade-in duration-300">
                        {matchingItems.length === 0 ? (
                          <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              No dishes in {cat.label} match your current filter.
                            </p>
                            <button
                              onClick={() => {
                                setDietaryFilter("all");
                                setSearchQuery("");
                              }}
                              className="mt-2 text-xs font-semibold text-chili-600 hover:underline"
                            >
                              Clear filters
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-3 pt-2">
                              <span>Showing all {matchingItems.length} dishes in {cat.label}</span>
                              <button
                                onClick={() => toggleCategory(cat.id)}
                                className="text-xs text-gray-400 hover:text-chili-600 transition-colors"
                              >
                                Close this category ↑
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {matchingItems.map((item) => (
                                <DishCard
                                  key={item.id}
                                  item={item}
                                  onAddWithOptions={handleAddWithOptions}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </div>
        ) : (
          /* CASE B: Specific Category Filtered Directly */
          <div>
            <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-chili-600 dark:text-chili-400">
                  Filtered Category
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  {categories.find((c) => c.id === activeCategory)?.label} ({totalMatchingItemsCount} Dishes)
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {categories.find((c) => c.id === activeCategory)?.description}
                </p>
              </div>
              <button
                onClick={() => setActiveCategory("all")}
                type="button"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-chili-600 hover:bg-chili-700 text-white shadow-md shadow-chili-600/20 transition-all flex items-center space-x-1.5"
              >
                <span>← View All Category Cards</span>
              </button>
            </div>

            {totalMatchingItemsCount === 0 ? (
              <div className="text-center py-16 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800">
                <p className="text-base font-semibold text-gray-700 dark:text-gray-300">
                  No dishes match your selected filter in this category.
                </p>
                <button
                  onClick={() => {
                    setDietaryFilter("all");
                    setSearchQuery("");
                  }}
                  className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold bg-chili-600 text-white"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {getMatchingItemsForCategory(activeCategory).map((item) => (
                  <DishCard
                    key={item.id}
                    item={item}
                    onAddWithOptions={handleAddWithOptions}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom Menu Notice */}
        <div className="mt-12 text-center p-6 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-800">
          <p className="font-serif italic text-base text-gray-800 dark:text-gray-200">
            "{RESTAURANT_DATA.brand.secondaryTagline} Thank You! Visit Again."
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Prices are all inclusive. For custom party packages or catering trays, call{" "}
            <a href={RESTAURANT_DATA.contact.telLink} className="text-chili-600 font-bold underline">
              {RESTAURANT_DATA.contact.displayPhone}
            </a>
            .
          </p>
        </div>

      </div>

      {/* Veg / Non-Veg Preference Modal */}
      {pendingOrderItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative bg-white dark:bg-gray-900 rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-gray-200 dark:border-gray-800 shadow-2xl space-y-5">
            <button
              onClick={() => setPendingOrderItem(null)}
              className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close preference modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-start space-x-3.5">
              {(pendingOrderItem.image || pendingOrderItem.image_url) && (
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-700 shadow-sm bg-gray-100 dark:bg-gray-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pendingOrderItem.image || pendingOrderItem.image_url}
                    alt={pendingOrderItem.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const parent = (e.currentTarget as HTMLElement).parentElement;
                      if (parent) parent.style.display = "none";
                    }}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300/40 mb-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Preference Required</span>
                </div>
                <h3 className="font-serif text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  Choose Veg or Non-Veg
                </h3>
                <p className="text-sm font-semibold text-chili-600 dark:text-chili-400 mt-0.5">
                  {pendingOrderItem.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  This dish can be freshly prepared Vegetarian or Non-Vegetarian. Please specify your preference:
                </p>
              </div>
            </div>

            {(() => {
              const { vegPrice, nonVegPrice } = getDietaryPricing(pendingOrderItem);
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedPreference("veg")}
                    className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between transition-all cursor-pointer ${
                      selectedPreference === "veg"
                        ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 shadow-sm ring-2 ring-emerald-500/20"
                        : "border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="w-4 h-4 rounded-sm border border-emerald-600 flex items-center justify-center p-0.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-600" />
                        </span>
                        {selectedPreference === "veg" && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full">
                            Selected
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                        Vegetarian (Veg)
                      </h4>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-tight">
                        Fresh veggies, paneer &amp; pure vegetarian preparation
                      </p>
                    </div>
                    <div className="mt-4 pt-2 border-t border-emerald-200/40 dark:border-emerald-800/40 flex items-baseline justify-between">
                      <span className="text-[10px] text-gray-400 uppercase">Price:</span>
                      <span className="font-bold text-base text-gray-900 dark:text-white font-sans">
                        ₹{vegPrice}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedPreference("non-veg")}
                    className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between transition-all cursor-pointer ${
                      selectedPreference === "non-veg"
                        ? "border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 shadow-sm ring-2 ring-rose-500/20"
                        : "border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="w-4 h-4 rounded-sm border border-rose-600 flex items-center justify-center p-0.5">
                          <span className="w-2 h-2 rounded-full bg-rose-600" />
                        </span>
                        {selectedPreference === "non-veg" && (
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
                        ₹{nonVegPrice}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })()}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPendingOrderItem(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingOrderItem) {
                    addItem(pendingOrderItem, selectedPreference, 1);
                    setPendingOrderItem(null);
                  }
                }}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold text-chili-700 dark:text-chili-300 bg-chili-50 dark:bg-chili-950/60 hover:bg-chili-100 border border-chili-200 dark:border-chili-800 active:scale-95 transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add to Order Tray</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingOrderItem) {
                    addItem(pendingOrderItem, selectedPreference, 1);
                    setPendingOrderItem(null);
                    openCart();
                  }
                }}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-md shadow-emerald-600/25 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Add &amp; View Tray</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Item Customer Order Modal */}
      {isCartOpen && (
        <OrderModal onClose={closeCart} />
      )}

      {/* Full Menu Card Modal (Inspired by Spicy Garden 03 - 4 High-Res Pages) */}
      {showFullMenuModal && (() => {
        const currentPage = printedPages[activeMenuPage] || printedPages[0] || {
          pageNumber: 1,
          title: "Official Menu Card",
          tag: "Cafe & Fast Food",
          categorySummary: "Pizzas, Pastas, Burgers, Sandwiches, Chinese & Drinks",
          image: RESTAURANT_DATA.assets.menuCardWebp || RESTAURANT_DATA.assets.menuCardFull,
          downloadName: "The_Spicy_Garden_Menu.png",
          highlights: []
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative bg-gray-900 rounded-2xl max-w-2xl sm:max-w-3xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 border border-gray-700 shadow-2xl text-white">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowFullMenuModal(false)}
                className="absolute top-4 right-4 z-20 p-2 rounded-full bg-gray-800/90 text-white hover:bg-chili-600 transition-colors cursor-pointer shadow-md"
                aria-label="Close menu card"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header Title & Subtitle */}
              <div className="text-center mb-4 pr-10 pl-2">
                <h3 className="text-lg sm:text-xl font-bold font-serif text-white">
                  Official Menu Card — The Spicy Garden Cafe & Bistro
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {RESTAURANT_DATA.contact.address.fullAddress} • Tel: {RESTAURANT_DATA.contact.displayPhone}
                </p>
              </div>

              {/* 4-Page Switcher Segmented Tabs & Download Action */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-gray-800">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {printedPages.map((page, idx) => {
                    const isActive = idx === activeMenuPage;
                    return (
                      <button
                        key={page.pageNumber}
                        type="button"
                        onClick={() => {
                          setActiveMenuPage(idx);
                          trackEvent("menu_opened", { type: `printed_card_tab_p${page.pageNumber}` });
                        }}
                        className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
                          isActive
                            ? "bg-chili-600 text-white shadow-sm shadow-chili-600/30 ring-1 ring-chili-400"
                            : "bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700"
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold font-mono ${
                          isActive ? "bg-white text-chili-600" : "bg-gray-700 text-gray-300"
                        }`}>
                          {page.pageNumber}
                        </span>
                        <span>{page.tag}</span>
                      </button>
                    );
                  })}
                </div>

                <a
                  href={currentPage.image}
                  download={currentPage.downloadName || `The_Spicy_Garden_Menu_P${currentPage.pageNumber}.png`}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors shadow-sm ml-auto cursor-pointer"
                  title={`Download Page ${activeMenuPage + 1}`}
                >
                  <Download className="w-3.5 h-3.5 text-chili-400" />
                  <span>Download P{activeMenuPage + 1}</span>
                </a>
              </div>

              {/* Active Page Category Title */}
              <div className="text-center mb-3">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-1">
                  Page {currentPage.pageNumber} of {printedPages.length}: {currentPage.title}
                </span>
                <p className="text-xs text-gray-400">
                  {currentPage.categorySummary}
                </p>
              </div>

              {/* Natural High-Res Full-Width Image View */}
              <div className="relative w-full rounded-xl overflow-hidden shadow-inner bg-black/60 border border-gray-800">
                <Image
                  src={currentPage.image}
                  alt={`The Spicy Garden Official Menu Card - Page ${currentPage.pageNumber} (${currentPage.title})`}
                  width={1536}
                  height={2752}
                  className="w-full h-auto object-contain rounded-lg"
                  priority
                />
              </div>

              {/* Footer Previous / Next Pagination */}
              <div className="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between">
                <button
                  type="button"
                  disabled={activeMenuPage === 0}
                  onClick={() => setActiveMenuPage((prev) => Math.max(0, prev - 1))}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous Page</span>
                </button>

                <span className="text-xs text-gray-400 font-mono">
                  Page {activeMenuPage + 1} of {printedPages.length}
                </span>

                <button
                  type="button"
                  disabled={activeMenuPage === printedPages.length - 1}
                  onClick={() => setActiveMenuPage((prev) => Math.min(printedPages.length - 1, prev + 1))}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <span>Next Page</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </section>
  );
}
