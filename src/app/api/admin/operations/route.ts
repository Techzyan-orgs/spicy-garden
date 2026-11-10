import { NextRequest, NextResponse } from 'next/server';
import {
  readOperationsFromStore,
  writeOperationsToStore,
  getLiveOperationalStatus,
} from '@/lib/operationsStore';
import { OperationsData } from '@/types/operations';
import { isAdminRequest } from '@/lib/authServer';
import { isFirebaseConfigured } from '@/lib/firebaseRtdb';

export const dynamic = 'force-dynamic';

const checkAdminAuth = isAdminRequest;

export async function GET(req: NextRequest) {
  if (!(await checkAdminAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized: Owner session required.' }, { status: 401 });
  }

  try {
    const operations = await readOperationsFromStore();
    const liveStatus = getLiveOperationalStatus(operations);
    const fbConfigured = isFirebaseConfigured();

    return NextResponse.json({
      operations,
      liveStatus,
      isFirebaseConfigured: fbConfigured,
      persistenceMode: fbConfigured ? 'firebase_realtime_db' : 'local_memory_fallback',
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch operations' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await checkAdminAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized: Owner session required.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const current = await readOperationsFromStore(true);

    const updated: OperationsData = {
      ...current,
      manualStatus: body.manualStatus ?? current.manualStatus,
      manualStatusNote: body.manualStatusNote !== undefined ? body.manualStatusNote : current.manualStatusNote,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Admin Portal',
      daysDisplay: (body.daysDisplay || current.daysDisplay).trim(),
      hoursDisplay: (body.hoursDisplay || current.hoursDisplay).trim(),
      shortHoursDisplay: (body.shortHoursDisplay || current.shortHoursDisplay).trim(),
      kitchenClosesDisplay: (body.kitchenClosesDisplay || current.kitchenClosesDisplay).trim(),
      regularOpenHour24: body.regularOpenHour24 !== undefined ? Number(body.regularOpenHour24) : current.regularOpenHour24,
      regularCloseHour24: body.regularCloseHour24 !== undefined ? Number(body.regularCloseHour24) : current.regularCloseHour24,
      fridayOpenHour24: body.fridayOpenHour24 !== undefined ? Number(body.fridayOpenHour24) : current.fridayOpenHour24,
      fridayCloseHour24: body.fridayCloseHour24 !== undefined ? Number(body.fridayCloseHour24) : current.fridayCloseHour24,
      schedule: Array.isArray(body.schedule) ? body.schedule : current.schedule,
      closureNotice: body.deleteNotice
        ? {
            enabled: false,
            title: '',
            message: '',
            startDate: '',
            endDate: '',
            reason: 'Holiday',
          }
        : body.closureNotice
        ? {
            enabled: Boolean(body.closureNotice.enabled),
            title: (body.closureNotice.title || '').trim(),
            message: (body.closureNotice.message || '').trim(),
            startDate: (body.closureNotice.startDate || '').trim(),
            endDate: (body.closureNotice.endDate || '').trim(),
            reason: (body.closureNotice.reason || 'General').trim(),
          }
        : current.closureNotice,
    };

    await writeOperationsToStore(updated);
    const liveStatus = getLiveOperationalStatus(updated);
    const fbConfigured = isFirebaseConfigured();

    return NextResponse.json({
      success: true,
      operations: updated,
      liveStatus,
      isFirebaseConfigured: fbConfigured,
    });
  } catch (err: any) {
    console.error('[API Admin Operations POST] Error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to save cafe operations settings.' },
      { status: 500 }
    );
  }
}
