// Fail production builds when required public config is missing. NEXT_PUBLIC_* values
// are inlined into the client bundle at build time, so they cannot be fixed at runtime.
// ( is not affected; the UI disables UPI payment when it is absent.)
if (process.env.NODE_ENV === 'production' && process.argv.includes('build')) {
  const upiId = (process.env.NEXT_PUBLIC_RESTAURANT_UPI_ID || '').trim();
  if (!/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/.test(upiId)) {
    throw new Error(
      'NEXT_PUBLIC_RESTAURANT_UPI_ID is missing or not a valid UPI VPA (e.g. name@bank). Set it before building.'
    );
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 480, 640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
      },
    ],
  },
  compress: true,
  poweredByHeader: false,
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.ably.io;"
      : "script-src 'self' 'unsafe-inline' https://*.ably.io;";

    const cspHeader = `
      default-src 'self';
      ${scriptSrc}
      style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
      img-src 'self' blob: data: https://res.cloudinary.com https://images.unsplash.com https://*.supabase.co https://maps.gstatic.com https://*.gstatic.com https://*.googleapis.com https://*.google.com https://*.google.co.in;
      font-src 'self' data: https://fonts.gstatic.com;
      connect-src 'self' https://*.ably.io wss://*.ably.io https://*.firebasedatabase.app https://*.firebaseio.com https://graph.facebook.com https://nominatim.openstreetmap.org https://places.googleapis.com;
      frame-src 'self' https://maps.google.com https://www.google.com https://*.google.com https://maps.google.co.in https://www.google.co.in https://*.google.co.in;
      frame-ancestors 'none';
      object-src 'none';
      base-uri 'self';
      form-action 'self';
    `.replace(/\s{2,}/g, ' ').trim();

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: cspHeader },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
}

module.exports = nextConfig
