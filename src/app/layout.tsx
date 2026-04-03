import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { Providers } from "./providers";
import { OrganizationJsonLd } from "@/components/shared/json-ld";
import { WebVitals } from "@/components/web-vitals";

function safeUrl(url: string | undefined, fallback: string): URL {
  try {
    return new URL(url || fallback)
  } catch {
    return new URL(fallback)
  }
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const inter = Inter({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: 'VroomX - Transportation Management System',
    template: '%s | VroomX',
  },
  description:
    'VroomX is a modern SaaS transportation management system for auto-transport carriers. Dispatch smarter, deliver faster.',
  metadataBase: safeUrl(process.env.NEXT_PUBLIC_APP_URL, 'http://localhost:3000'),
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
  openGraph: {
    title: 'VroomX - Transportation Management System',
    description:
      'Modern SaaS TMS for auto-transport carriers. Manage orders, dispatch trips, track drivers, and automate billing.',
    type: 'website',
    siteName: 'VroomX',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VroomX - Transportation Management System',
    description:
      'Modern SaaS TMS for auto-transport carriers.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${inter.variable} antialiased`}
      >
        <OrganizationJsonLd />
        <Providers>
          <WebVitals />
          {children}
        </Providers>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
