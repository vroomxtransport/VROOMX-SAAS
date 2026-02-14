'use client'

import React, { useRef, type ElementType, type ComponentPropsWithoutRef } from 'react'
import { motion, useInView, type Variants } from 'framer-motion'
import { cn } from '@/lib/utils'

interface TimelineContentProps<T extends ElementType = 'div'> {
  as?: T
  animationNum?: number
  timelineRef?: React.RefObject<HTMLElement | null>
  customVariants?: Variants
  className?: string
  children?: React.ReactNode
}

export function TimelineContent<T extends ElementType = 'div'>({
  as,
  animationNum = 0,
  timelineRef,
  customVariants,
  className,
  children,
  ...props
}: TimelineContentProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof TimelineContentProps<T>>) {
  const localRef = useRef<HTMLElement>(null)
  const isInView = useInView(timelineRef ?? localRef, {
    once: true,
    margin: '-10% 0px -10% 0px',
  })

  const Component = motion.create(as ?? 'div') as React.ComponentType<any>

  const defaultVariants: Variants = {
    hidden: { opacity: 0, y: 20, filter: 'blur(8px)' },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        delay: i * 0.15,
        duration: 0.5,
        ease: [0.25, 0.4, 0.25, 1],
      },
    }),
  }

  const variants = customVariants ?? defaultVariants

  return (
    <Component
      ref={localRef}
      custom={animationNum}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      className={cn(className)}
      {...props}
    >
      {children}
    </Component>
  )
}
