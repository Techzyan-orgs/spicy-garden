"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { RESTAURANT_DATA, GalleryImage } from "@/data/restaurantData";
import { Sparkles, Maximize2, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

export default function AmbianceGallery() {
  const [activeFilter, setActiveFilter] = useState<"all" | "food" | "ambiance" | "celebration">("all");
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);

  const images = RESTAURANT_DATA.gallery;

  const filteredImages = images.filter(
    (img) => activeFilter === "all" || img.category === activeFilter
  );

  const handleOpenLightbox = (index: number) => {
    setIsImageLoading(true);
    setActiveImageIndex(index);
  };

  const handleNext = useCallback(() => {
    if (activeImageIndex !== null) {
      setIsImageLoading(true);
      setActiveImageIndex((activeImageIndex + 1) % filteredImages.length);
    }
  }, [activeImageIndex, filteredImages.length]);

  const handlePrev = useCallback(() => {
    if (activeImageIndex !== null) {
      setIsImageLoading(true);
      setActiveImageIndex((activeImageIndex - 1 + filteredImages.length) % filteredImages.length);
    }
  }, [activeImageIndex, filteredImages.length]);

  // Keyboard navigation (ArrowLeft, ArrowRight, Escape)
  useEffect(() => {
    if (activeImageIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveImageIndex(null);
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeImageIndex, handleNext, handlePrev]);

  // Preload next and previous images into memory for instant navigation
  useEffect(() => {
    if (activeImageIndex === null || filteredImages.length === 0) return;

    const nextIdx = (activeImageIndex + 1) % filteredImages.length;
    const prevIdx = (activeImageIndex - 1 + filteredImages.length) % filteredImages.length;

    [filteredImages[nextIdx]?.src, filteredImages[prevIdx]?.src].forEach((src) => {
      if (src && typeof window !== "undefined") {
        const img = new window.Image();
        img.src = src;
      }
    });
  }, [activeImageIndex, filteredImages]);

  return (
    <section id="gallery" className="py-20 bg-gray-50/60 dark:bg-gray-900/40 scroll-mt-20 border-t border-gray-200/60 dark:border-gray-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-chili-100 dark:bg-chili-950/80 text-chili-700 dark:text-chili-300 border border-chili-200 dark:border-chili-800 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cozy Cafe Vibes & Asian Murals</span>
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            Experience Our Ambiance & Dishes
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {`Step into our warm air-conditioned cafe in ${RESTAURANT_DATA.contact.address.locality}, ${RESTAURANT_DATA.contact.address.city}. Admire our signature Geisha and Ramen murals while enjoying your favorite bites.`}
          </p>

          {/* Filter Tabs */}
          <div className="mt-6 flex items-center justify-center space-x-2">
            {[
              { id: "all", label: "All Photos" },
              { id: "ambiance", label: "Cafe & Murals" },
              { id: "food", label: "Delicious Food" },
              { id: "celebration", label: "Celebrations" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveFilter(tab.id as any);
                  setActiveImageIndex(null);
                }}
                type="button"
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeFilter === tab.id
                    ? "bg-chili-600 text-white shadow-md shadow-chili-600/20"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredImages.map((image, index) => (
            <div
              key={image.id}
              onClick={() => handleOpenLightbox(index)}
              className="group relative rounded-2xl overflow-hidden aspect-[4/3] bg-gray-200 dark:bg-gray-800 cursor-pointer border border-gray-200/80 dark:border-gray-800 shadow-sm hover:shadow-xl transition-all duration-300"
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                loading="lazy"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                placeholder="blur"
                blurDataURL={RESTAURANT_DATA.assetPlaceholders.default}
                decoding="async"
                className="object-cover group-hover:scale-110 transition-transform duration-500"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3.5 text-white">
                <span className="text-[10px] uppercase font-bold tracking-widest text-amber-300">
                  {image.category}
                </span>
                <p className="text-xs font-bold leading-snug line-clamp-1">
                  {image.title}
                </p>
                <div className="flex items-center space-x-1 mt-1 text-[10px] text-gray-300">
                  <Maximize2 className="w-3 h-3" />
                  <span>Tap to enlarge</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Lightbox Modal */}
      {activeImageIndex !== null && filteredImages[activeImageIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/95 backdrop-blur-md animate-in fade-in duration-200">
          {/* Top Close Button */}
          <button
            onClick={() => setActiveImageIndex(null)}
            className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-gray-800/90 text-white hover:bg-chili-600 transition-all shadow-lg active:scale-95 cursor-pointer"
            aria-label="Close image lightbox"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Left / Prev Arrow */}
          <button
            onClick={handlePrev}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 p-2.5 sm:p-3 rounded-full bg-gray-800/90 text-white hover:bg-chili-600 transition-all shadow-lg active:scale-95 cursor-pointer"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Right / Next Arrow */}
          <button
            onClick={handleNext}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 p-2.5 sm:p-3 rounded-full bg-gray-800/90 text-white hover:bg-chili-600 transition-all shadow-lg active:scale-95 cursor-pointer"
            aria-label="Next image"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Main Photo & Caption Container */}
          <div className="max-w-4xl w-full flex flex-col items-center select-none">
            <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] max-h-[72vh] rounded-2xl overflow-hidden shadow-2xl border border-gray-800 bg-gray-950 flex items-center justify-center">
              
              {/* Spinner while loading / decoding */}
              {isImageLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2.5 bg-gray-950/90 z-10 animate-in fade-in duration-150">
                  <Loader2 className="w-8 h-8 text-chili-500 animate-spin" />
                  <span className="text-xs text-gray-400 font-medium">Loading high-res photo...</span>
                </div>
              )}

              <Image
                key={filteredImages[activeImageIndex].src}
                src={filteredImages[activeImageIndex].src}
                alt={filteredImages[activeImageIndex].alt}
                fill
                priority
                quality={85}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
                className={`object-contain transition-opacity duration-300 ${
                  isImageLoading ? "opacity-0" : "opacity-100"
                }`}
                onLoad={() => setIsImageLoading(false)}
                onError={() => setIsImageLoading(false)}
              />
            </div>
            
            <div className="mt-4 text-center text-white max-w-lg px-2">
              <h4 className="text-base sm:text-lg font-bold font-serif text-white">
                {filteredImages[activeImageIndex].title}
              </h4>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                {filteredImages[activeImageIndex].description}
              </p>
              <p className="text-[11px] font-mono text-gray-400 mt-1.5 font-bold">
                {activeImageIndex + 1} of {filteredImages.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
