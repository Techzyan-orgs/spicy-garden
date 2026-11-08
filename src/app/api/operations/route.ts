import { NextResponse } from 'next/server';
import { getLiveOperationalStatus, readOperationsFromStore } from '@/lib/operationsStore';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export async function GET() {
  try {
    const operations = await readOperationsFromStore();
    const liveStatus = getLiveOperationalStatus(operations);
    return NextResponse.json(liveStatus, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch operations' }, { status: 500 });
  }
}
