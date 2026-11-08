import { NextResponse } from 'next/server';
import { RESTAURANT_DATA } from '@/data/restaurantData';

export const revalidate = 3600; // Edge Cache for 1 hour

let cachedRating: {
  rating: string;
  totalReviews: string;
  userRatingsTotal: number;
  source: string;
  googleMapsUrl: string;
  timestamp: number;
} | null = null;

export async function GET() {
  try {
    const now = Date.now();
    // Return cached value if fetched within the last hour
    if (cachedRating && now - cachedRating.timestamp < 3600 * 1000) {
      return NextResponse.json(cachedRating, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    }

    const apiKey =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_PLACES_API_KEY;

    // If an API key is configured, fetch from Places API (New) with field masking
    if (apiKey) {
      try {
        const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.rating,places.userRatingCount,places.googleMapsUri',
          },
          body: JSON.stringify({
            textQuery: 'The Spicy Garden Baguiati Kolkata',
            languageCode: 'en',
          }),
          next: { revalidate: 3600 },
        });

        if (res.ok) {
          const data = await res.json();
          const place = data.places?.[0];
          if (place && place.rating) {
            cachedRating = {
              rating: place.rating.toFixed(1),
              totalReviews: `${place.userRatingCount || 95}+`,
              userRatingsTotal: place.userRatingCount || 95,
              source: 'google_places_api',
              googleMapsUrl:
                place.googleMapsUri ||
                RESTAURANT_DATA.contact.geo.googleMapsUrl,
              timestamp: now,
            };
            return NextResponse.json(cachedRating, {
              headers: {
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
              },
            });
          }
        }
      } catch (apiErr) {
        console.warn('[Google Rating API] Places API fetch failed, falling back:', apiErr);
      }
    }

    // Default to verified Google Business Profile rating
    const profileRating = {
      rating: RESTAURANT_DATA.stats.averageRating || '4.8',
      totalReviews: RESTAURANT_DATA.stats.totalReviews || '95+',
      userRatingsTotal: 95,
      source: 'google_business_profile',
      googleMapsUrl: RESTAURANT_DATA.contact.geo.googleMapsUrl,
      timestamp: now,
    };
    cachedRating = profileRating;

    return NextResponse.json(profileRating, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        rating: '4.8',
        totalReviews: '95+',
        source: 'google_business_profile_fallback',
        googleMapsUrl: RESTAURANT_DATA.contact.geo.googleMapsUrl,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  }
}
