import QRCode from 'qrcode';

/**
 * Generates a high-resolution QR code data URL locally in the client browser.
 * Eliminates external third-party network dependencies and protects payment privacy.
 */
export async function generateQrDataUrl(text: string, width = 160): Promise<string> {
  if (!text) return '';
  try {
    return await QRCode.toDataURL(text, {
      width,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('[QRCode] Failed to generate QR code locally:', err);
    return '';
  }
}
