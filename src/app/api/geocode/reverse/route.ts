export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getClientIp } from '@/lib/apiGuard';
import { storeErrorResponse } from '@/lib/apiErrors';

/**
 * Server-side Reverse Geocoding Route with LRU/TTL In-Memory Cache
 * Resolves GPS coordinates (latitude, longitude) to a human-readable street/area address.
 * Caches responses by approximate coordinate block to respect Nominatim TOS and prevent rate-limits.
 */

interface CacheEntry {
  timestamp: number;
  data: {
    address: string;
    displayName: string;
    lat: number;
    lng: number;
    mapsLink: string;
  };
}

const geocodeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(lat: number, lng: number): string {
  // Round to ~3 decimal places (~110m resolution)
  return `${lat.toFixed(3)}_${lng.toFixed(3)}`;
}

export async function GET(req: NextRequest) {
  try {
    // Distributed per-IP limit protects the Nominatim upstream (15 requests / minute).
    const limited = await enforceRateLimit(
      'geocode',
      getClientIp(req),
      'Too many location requests. Please wait a moment before trying again.'
    );
    if (limited) return limited;
    const { searchParams } = new URL(req.url);
    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');

    if (!latStr || !lngStr) {
      return NextResponse.json(
        { error: 'Latitude and longitude parameters are required.' },
        { status: 400 }
      );
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: 'Invalid coordinate values.' },
        { status: 400 }
      );
    }

    const cacheKey = getCacheKey(lat, lng);
    const cached = geocodeCache.get(cacheKey);
    const now = Date.now();
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        success: true,
        ...cached.data,
      });
    }

    const fallbackCoordStr = `Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

      const res = await fetch(nominatimUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TheSpicyGardenRestaurant/1.0 (BistroOrderDelivery; info@thespicygarden.com)',
          'Accept-Language': 'en-IN,en;q=0.9',
        },
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};

        const parts: string[] = [];

        const primary =
          addr.road ||
          addr.suburb ||
          addr.neighbourhood ||
          addr.commercial ||
          addr.residential ||
          addr.pedestrian ||
          addr.building;

        if (primary) parts.push(primary);

        const secondary =
          (addr.suburb && addr.suburb !== primary ? addr.suburb : null) ||
          (addr.neighbourhood && addr.neighbourhood !== primary ? addr.neighbourhood : null) ||
          addr.hamlet ||
          addr.village;

        if (secondary) parts.push(secondary);

        const city = addr.city || addr.town || addr.municipality || addr.county;
        if (city && !parts.includes(city)) parts.push(city);

        const district = addr.state_district;
        if (district && !parts.includes(district)) parts.push(district);

        const state = addr.state;
        if (state && !parts.includes(state)) parts.push(state);

        const postcode = addr.postcode;
        if (postcode) parts.push(postcode);

        const formattedAddress = parts.length > 0 ? parts.join(', ') : (data.display_name || fallbackCoordStr);

        const responsePayload = {
          address: formattedAddress,
          displayName: data.display_name || formattedAddress,
          lat,
          lng,
          mapsLink,
        };

        // Cache result
        geocodeCache.set(cacheKey, { timestamp: now, data: responsePayload });

        // Cap cache size
        if (geocodeCache.size > 500) {
          const oldestKey = geocodeCache.keys().next().value;
          if (oldestKey) geocodeCache.delete(oldestKey);
        }

        return NextResponse.json({
          success: true,
          ...responsePayload,
        });
      }
    } catch (fetchErr) {
      console.warn('[ReverseGeocode] Nominatim request failed, falling back:', fetchErr);
    }

    return NextResponse.json({
      success: true,
      address: fallbackCoordStr,
      displayName: fallbackCoordStr,
      lat,
      lng,
      mapsLink,
    });
  } catch (err) {
    return storeErrorResponse(err, 'ReverseGeocode', 'Failed to resolve location.');
  }
}
