'use client'

import { motion, useScroll } from 'motion/react'

export function ReadingProgressBar() {
  const { scrollYProgress } = useScroll()

  return (
    <motion.div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      className="fixed top-16 left-0 right-0 z-50 h-0.5 origin-left"
      style={{
        scaleX: scrollYProgress,
        background: 'linear-gradient(to right, var(--brand), #2a3a4f)',
        transformOrigin: 'left',
      }}
    />
  )
}
