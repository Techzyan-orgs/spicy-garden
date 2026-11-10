import { NextRequest, NextResponse } from 'next/server';
import {
  readOperationsFromStore,
  writeOperationsToStore,
  getLiveOperationalStatus,
  OperationsNotConfiguredError,
} from '@/lib/operationsStore';
import { OperationsData } from '@/types/operations';
import { requireAdmin } from '@/lib/apiGuard';
import { storeErrorResponse } from '@/lib/apiErrors';

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';


function text(value: unknown, current: string | undefined): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : current;
}

function hour(value: unknown, current: number | undefined): number | undefined {
  return value !== undefined && value !== null && value !== '' ? Number(value) : current;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const operations = await readOperationsFromStore(true);
    return NextResponse.json(
      {
        operations,
        liveStatus: getLiveOperationalStatus(operations),
        isFirebaseConfigured: true,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    return storeErrorResponse(err, 'API Admin Operations', 'Failed to fetch operations.');
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be a JSON object.' }, { status: 400 });
    }

    // When nothing is stored yet the body must contain a complete record (validated below).
    let current: Partial<OperationsData> = {};
    try {
      current = await readOperationsFromStore(true);
    } catch (err) {
      if (!(err instanceof OperationsNotConfiguredError)) throw err;
    }

    const notice = body.closureNotice;
    const candidate = {
      ...current,
      manualStatus: body.manualStatus ?? current.manualStatus,
      manualStatusNote:
        typeof body.manualStatusNote === 'string' ? body.manualStatusNote.trim() : current.manualStatusNote ?? '',
      updatedAt: new Date().toISOString(),
      updatedBy: 'Admin Portal',
      daysDisplay: text(body.daysDisplay, current.daysDisplay),
      hoursDisplay: text(body.hoursDisplay, current.hoursDisplay),
      shortHoursDisplay: text(body.shortHoursDisplay, current.shortHoursDisplay),
      kitchenClosesDisplay: text(body.kitchenClosesDisplay, current.kitchenClosesDisplay),
      regularOpenHour24: hour(body.regularOpenHour24, current.regularOpenHour24),
      regularCloseHour24: hour(body.regularCloseHour24, current.regularCloseHour24),
      fridayOpenHour24: hour(body.fridayOpenHour24, current.fridayOpenHour24),
      fridayCloseHour24: hour(body.fridayCloseHour24, current.fridayCloseHour24),
      schedule: Array.isArray(body.schedule) ? body.schedule : current.schedule,
      closureNotice: body.deleteNotice
        ? { enabled: false, title: '', message: '', startDate: '', endDate: '', reason: 'Holiday' }
        : notice && typeof notice === 'object'
        ? {
            enabled: Boolean(notice.enabled),
            title: String(notice.title ?? '').trim(),
            message: String(notice.message ?? '').trim(),
            startDate: String(notice.startDate ?? '').trim(),
            endDate: String(notice.endDate ?? '').trim(),
            reason: String(notice.reason || 'General').trim(),
          }
        : current.closureNotice,
    };

    // Validates the full record; throws OperationsValidationError (→ 400) on bad input.
    const saved = await writeOperationsToStore(candidate as OperationsData);

    return NextResponse.json({
      success: true,
      operations: saved,
      liveStatus: getLiveOperationalStatus(saved),
      isFirebaseConfigured: true,
    });
  } catch (err) {
    return storeErrorResponse(err, 'API Admin Operations', 'Failed to save café operations settings.');
  }
}
