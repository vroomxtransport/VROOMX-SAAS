import type { Metadata } from 'next'
import { Caveat } from 'next/font/google'

// Caveat loaded here so it's available as --font-signature across the entire
// (public) route group. The root layout already loads body/display fonts.
const caveat = Caveat({
  variable: '--font-signature',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // Dark navy background matching reference screenshots: #0C1220
    // font-signature var propagates to all signature boxes in this group
    <div
      className={`${caveat.variable} min-h-screen`}
      style={{ backgroundColor: '#0C1220' }}
    >
      {children}
    </div>
  )
}
