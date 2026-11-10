import { NextResponse } from 'next/server';
import { getLiveOperationalStatus, readOperationsFromStore } from '@/lib/operationsStore';
import { storeErrorResponse } from '@/lib/apiErrors';

export const dynamic = 'force-dynamic';

/** Public live café status. Served only from Firebase; 503 when unavailable. */
export async function GET() {
  try {
    const operations = await readOperationsFromStore();
    const liveStatus = getLiveOperationalStatus(operations);
    return NextResponse.json(liveStatus, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    return storeErrorResponse(err, 'API Operations', 'Failed to fetch operations.');
  }
}
