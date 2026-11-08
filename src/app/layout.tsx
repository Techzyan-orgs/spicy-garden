import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CartProvider } from "@/context/CartContext";
import { CafeOperationsProvider } from "@/context/CafeOperationsContext";
import { RESTAURANT_DATA, getRestaurantStructuredData } from "@/data/restaurantData";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0d14" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(RESTAURANT_DATA.seo.canonicalUrl),
  title: {
    default: RESTAURANT_DATA.seo.title,
    template: `%s | ${RESTAURANT_DATA.brand.shortName}`,
  },
  description: RESTAURANT_DATA.seo.metaDescription,
  keywords: RESTAURANT_DATA.seo.keywords,
  authors: [{ name: RESTAURANT_DATA.brand.name }],
  creator: RESTAURANT_DATA.brand.name,
  openGraph: {
    type: "website",
    locale: RESTAURANT_DATA.seo.locale,
    url: RESTAURANT_DATA.seo.canonicalUrl,
    title: RESTAURANT_DATA.seo.title,
    description: RESTAURANT_DATA.seo.metaDescription,
    siteName: RESTAURANT_DATA.seo.siteName,
    images: [
      {
        url: RESTAURANT_DATA.seo.ogImage,
        width: 1200,
        height: 630,
        alt: `${RESTAURANT_DATA.brand.name} Gourmet Pizza & Bistro Dining`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: RESTAURANT_DATA.seo.title,
    description: RESTAURANT_DATA.seo.metaDescription,
    images: [RESTAURANT_DATA.seo.ogImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: RESTAURANT_DATA.seo.canonicalUrl,
  },
  icons: {
    icon: RESTAURANT_DATA.assets.logo,
    apple: RESTAURANT_DATA.assets.logo,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = getRestaurantStructuredData();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* JSON-LD Local Business Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased selection:bg-chili-500 selection:text-white min-h-screen">
        <ThemeProvider>
          <CartProvider>
            <CafeOperationsProvider>
              {children}
            </CafeOperationsProvider>
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
