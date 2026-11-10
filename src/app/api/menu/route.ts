import { NextResponse } from 'next/server';
import { readMenuFromStore } from '@/lib/menuStore';
import { storeErrorResponse } from '@/lib/apiErrors';

export const dynamic = 'force-dynamic';

/** Public menu. Served only from Firebase; 503 when the database is unavailable. */
export async function GET() {
  try {
    const { categories, items } = await readMenuFromStore();
    return NextResponse.json(
      { source: 'firebase', categories, items },
      {
        headers: {
          // Short CDN cache of the last good database response; errors are never cached.
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
        },
      }
    );
  } catch (err) {
    return storeErrorResponse(err, 'API Menu', 'Failed to load menu data.');
  }
}
