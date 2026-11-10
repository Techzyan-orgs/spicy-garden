/**
 * Public (browser-exposed) configuration. Values are inlined at build time.
 * There are no hardcoded fallbacks: production builds fail in next.config.js
 * when a required value is missing, and the UI disables the dependent feature
 * when a value is absent in development.
 */

const UPI_VPA_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;

const rawUpiId = (process.env.NEXT_PUBLIC_RESTAURANT_UPI_ID || '').trim();

/** Restaurant UPI VPA, or '' when not configured / invalid (UPI payment is then disabled). */
export const RESTAURANT_UPI_ID = UPI_VPA_PATTERN.test(rawUpiId) ? rawUpiId : '';

export const isUpiConfigured = RESTAURANT_UPI_ID !== '';

export function buildUpiPaymentUrl(amount: number, note: string): string {
  if (!isUpiConfigured) return '';
  const params = new URLSearchParams({
    pa: RESTAURANT_UPI_ID,
    pn: 'The Spicy Garden',
    am: String(amount),
    cu: 'INR',
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}
