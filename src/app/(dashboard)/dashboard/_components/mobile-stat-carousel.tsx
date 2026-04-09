'use client'

import type { ReactNode } from 'react'

interface MobileStatCarouselProps {
  children: ReactNode
}

/**
 * Horizontal snap-scroll carousel for stat cards on mobile (below md).
 *
 * Usage in page.tsx (server component friendly — this is a pure presentational
 * wrapper with no hooks):
 *
 * ```tsx
 * // Mobile carousel (shown below md)
 * <MobileStatCarousel>
 *   <MobileStatSlide><StatCard ... /></MobileStatSlide>
 *   <MobileStatSlide><StatCard ... /></MobileStatSlide>
 * </MobileStatCarousel>
 *
 * // Desktop grid (shown at md and above — kept entirely separate)
 * <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-3">
 *   <StatCard ... />
 * </div>
 * ```
 *
 * The two rendering paths are independent so the desktop grid layout is
 * completely unaffected.
 */
export function MobileStatCarousel({ children }: MobileStatCarouselProps) {
  return (
    <div
      className="md:hidden flex overflow-x-auto snap-x snap-mandatory gap-3 -mx-3 px-3 pb-2 scrollbar-none"
      // Native momentum scrolling on iOS
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {children}
    </div>
  )
}

/**
 * Individual slide within MobileStatCarousel.
 * Enforces snap alignment and prevents cards from collapsing below
 * their natural width inside the flex scroll container.
 */
export function MobileStatSlide({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-[200px] snap-start shrink-0">
      {children}
    </div>
  )
}
