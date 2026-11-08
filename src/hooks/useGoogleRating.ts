'use client';

import { useState, useEffect } from 'react';
import { RESTAURANT_DATA } from '@/data/restaurantData';

export interface GoogleRatingState {
  rating: string;
  totalReviews: string;
}

let cachedRating: GoogleRatingState | null = null;
let inFlightRatingPromise: Promise<GoogleRatingState | null> | null = null;
const ratingListeners = new Set<(state: GoogleRatingState) => void>();

async function getOrFetchRating(): Promise<GoogleRatingState | null> {
  if (cachedRating) {
    return cachedRating;
  }
  if (inFlightRatingPromise) {
    return inFlightRatingPromise;
  }

  inFlightRatingPromise = (async () => {
    try {
      const res = await fetch('/api/google/rating');
      if (!res.ok) throw new Error('Failed to fetch Google rating');
      const data = await res.json();
      if (data?.rating) {
        const newState: GoogleRatingState = {
          rating: String(data.rating),
          totalReviews: String(data.totalReviews || RESTAURANT_DATA.stats.totalReviews),
        };
        cachedRating = newState;
        ratingListeners.forEach((listener) => listener(newState));
        return newState;
      }
    } catch (err) {
      // Soft fail, fallback to default restaurant stats
    } finally {
      inFlightRatingPromise = null;
    }
    return cachedRating;
  })();

  return inFlightRatingPromise;
}

export function useGoogleRating(): GoogleRatingState {
  const [ratingState, setRatingState] = useState<GoogleRatingState>(() => {
    return cachedRating || {
      rating: RESTAURANT_DATA.stats.averageRating,
      totalReviews: RESTAURANT_DATA.stats.totalReviews,
    };
  });

  useEffect(() => {
    let isMounted = true;
    const handleUpdate = (state: GoogleRatingState) => {
      if (isMounted) {
        setRatingState(state);
      }
    };

    ratingListeners.add(handleUpdate);

    if (cachedRating) {
      setRatingState(cachedRating);
    } else {
      getOrFetchRating().then((state) => {
        if (isMounted && state) {
          setRatingState(state);
        }
      });
    }

    return () => {
      isMounted = false;
      ratingListeners.delete(handleUpdate);
    };
  }, []);

  return ratingState;
}
