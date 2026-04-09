'use client'

import { useRef, useState, useCallback, type ReactNode } from 'react'
import { motion, useMotionValue, useTransform } from 'motion/react'

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void
  children: ReactNode
  className?: string
}

const THRESHOLD = 80
const MAX_PULL = 120

export function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pullDistance = useMotionValue(0)
  const spinnerOpacity = useTransform(pullDistance, [0, THRESHOLD * 0.5, THRESHOLD], [0, 0.5, 1])
  const spinnerScale = useTransform(pullDistance, [0, THRESHOLD], [0.5, 1])
  const spinnerRotate = useTransform(pullDistance, [0, MAX_PULL], [0, 360])

  const startY = useRef(0)
  const isPulling = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return
    // Only pull-to-refresh when scrolled to the top
    const scrollTop = containerRef.current?.closest('[data-scroll-container]')?.scrollTop
      ?? containerRef.current?.parentElement?.scrollTop
      ?? 0
    if (scrollTop > 5) return

    startY.current = e.touches[0].clientY
    isPulling.current = true
  }, [isRefreshing])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return
    const delta = Math.max(0, e.touches[0].clientY - startY.current)
    // Rubber-band effect
    const dampened = Math.min(MAX_PULL, delta * 0.5)
    pullDistance.set(dampened)
  }, [isRefreshing, pullDistance])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return
    isPulling.current = false

    if (pullDistance.get() >= THRESHOLD && !isRefreshing) {
      setIsRefreshing(true)
      pullDistance.set(THRESHOLD * 0.6) // Hold at partial position
      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
        pullDistance.set(0)
      }
    } else {
      pullDistance.set(0)
    }
  }, [isRefreshing, onRefresh, pullDistance])

  return (
    <div
      ref={containerRef}
      className={className}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div className="flex justify-center overflow-hidden lg:hidden">
        <motion.div
          style={{ opacity: spinnerOpacity, scale: spinnerScale }}
          className="flex items-center justify-center py-2"
        >
          <motion.div
            style={{ rotate: isRefreshing ? undefined : spinnerRotate }}
            animate={isRefreshing ? { rotate: 360 } : undefined}
            transition={isRefreshing ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : undefined}
            className="h-5 w-5 rounded-full border-2 border-brand border-t-transparent"
          />
        </motion.div>
      </div>

      {children}
    </div>
  )
}
