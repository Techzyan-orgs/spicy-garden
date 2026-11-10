import { NextResponse } from 'next/server';
import { ConfigError } from './env';
import { DataUnavailableError, InvalidKeyError } from './firebaseAdmin';
import {
  MenuMigrationRequiredError,
  MenuValidationError,
  CategoryInUseError,
  MenuNotFoundError,
} from './menuStore';
import { OperationsValidationError } from './operationsStore';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Maps store/config errors to safe HTTP responses. Internal details are
 * logged server-side; only curated messages reach the client.
 */
export function storeErrorResponse(err: unknown, context: string, fallbackMessage: string): NextResponse {
  if (err instanceof MenuValidationError || err instanceof InvalidKeyError) {
    return NextResponse.json({ error: err.message }, { status: 400, headers: NO_STORE });
  }
  if (err instanceof OperationsValidationError) {
    return NextResponse.json({ error: 'Invalid operations data.', issues: err.issues }, { status: 400, headers: NO_STORE });
  }
  if (err instanceof MenuNotFoundError) {
    return NextResponse.json({ error: err.message }, { status: 404, headers: NO_STORE });
  }
  if (err instanceof CategoryInUseError || err instanceof MenuMigrationRequiredError) {
    return NextResponse.json({ error: err.message }, { status: 409, headers: NO_STORE });
  }
  if (err instanceof DataUnavailableError) {
    console.error(`[${context}] Data unavailable:`, err.message, (err as { cause?: unknown }).cause ?? '');
    return NextResponse.json(
      { error: 'This information is temporarily unavailable. Please try again shortly.', retryable: true },
      { status: 503, headers: { ...NO_STORE, 'Retry-After': '30' } }
    );
  }
  if (err instanceof ConfigError) {
    console.error(`[${context}] Server misconfiguration:`, err.message);
    return NextResponse.json({ error: 'Service unavailable: server is misconfigured.' }, { status: 503, headers: NO_STORE });
  }
  console.error(`[${context}] Unexpected error:`, err);
  return NextResponse.json({ error: fallbackMessage }, { status: 500, headers: NO_STORE });
}
