/**
 * Masks a phone number for display (e.g. "98****3210").
 * Client-safe: no Node built-ins, so importing it does not bundle crypto code.
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) {
    return `${clean.slice(0, 2)}****${clean.slice(6)}`;
  }
  if (clean.length > 4) {
    return `${clean.slice(0, 2)}****${clean.slice(-2)}`;
  }
  return '******';
}
