'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface TimelineItem {
  id: string
  title: string
  description: string
  icon: ReactNode
  status: 'completed' | 'in-progress' | 'pending'
  date?: string
}

interface RadialOrbitalTimelineProps {
  timelineData: TimelineItem[]
}

const statusStyles = {
  completed: {
    ring: 'border-border',
    bg: 'bg-muted/60',
    icon: 'text-foreground',
    label: 'Completed',
    labelColor: 'text-brand',
  },
  'in-progress': {
    ring: 'border-border',
    bg: 'bg-muted/60',
    icon: 'text-foreground',
    label: 'In Progress',
    labelColor: 'text-amber-600',
  },
  pending: {
    ring: 'border-border',
    bg: 'bg-muted/60',
    icon: 'text-foreground',
    label: 'Planned',
    labelColor: 'text-muted-foreground',
  },
} as const

export function RadialOrbitalTimeline({ timelineData }: RadialOrbitalTimelineProps) {
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [angleOffset, setAngleOffset] = useState(0)
  const rotatingRef = useRef(true)
  const animFrameRef = useRef<number>(0)

  // rAF-based rotation
  useEffect(() => {
    let lastTime = performance.now()

    const animate = (now: number) => {
      if (rotatingRef.current) {
        const delta = (now - lastTime) / 1000
        setAngleOffset((prev) => (prev + delta * 6) % 360)
      }
      lastTime = now
      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [])

  const handleNodeClick = useCallback((index: number) => {
    setSelectedIndex((prev) => {
      if (prev === index) {
        rotatingRef.current = true
        return -1
      }
      rotatingRef.current = false
      return index
    })
  }, [])

  const handleBackgroundClick = useCallback(() => {
    setSelectedIndex(-1)
    rotatingRef.current = true
  }, [])

  const total = timelineData.length
  const selectedItem = selectedIndex >= 0 ? timelineData[selectedIndex] : null
  const selectedStatus = selectedItem ? statusStyles[selectedItem.status] : null

  return (
    <div
      className="relative mx-auto w-[340px] h-[340px] sm:w-[440px] sm:h-[440px] lg:w-[520px] lg:h-[520px]"
      onClick={handleBackgroundClick}
    >
      {/* Orbit ring */}
      <div className="absolute inset-[15%] rounded-full border border-border" />

      {/* Center logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={cn(
            'transition-all duration-500',
            selectedItem
              ? 'opacity-0 scale-75'
              : 'opacity-100 scale-100'
          )}
        >
          <Image
            src="/images/logo-white.png"
            alt="VroomX"
            width={120}
            height={34}
            className="h-[100px] w-auto brightness-0 sm:h-[125px]"
          />
        </div>
      </div>

      {/* Selected node detail card (center) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={cn(
            'z-10 w-44 sm:w-56 transition-all duration-500 ease-out pointer-events-auto',
            selectedItem ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {selectedItem && selectedStatus && (
            <div className="widget-card-primary rounded-2xl p-4 sm:p-5 text-center shadow-lg">
              <div
                className={cn(
                  'mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl',
                  selectedStatus.bg
                )}
              >
                <span className={cn('[&>svg]:h-5 [&>svg]:w-5', selectedStatus.icon)}>
                  {selectedItem.icon}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground leading-tight">
                {selectedItem.title}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {selectedItem.description}
              </p>
              <span
                className={cn(
                  'mt-2 inline-block text-[10px] font-semibold uppercase tracking-wider',
                  selectedStatus.labelColor
                )}
              >
                {selectedStatus.label}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Nodes */}
      {timelineData.map((item, index) => {
        const angle = ((360 / total) * index - 90 + angleOffset) % 360
        const rad = (angle * Math.PI) / 180
        const radius = 35
        const x = 50 + radius * Math.cos(rad)
        const y = 50 + radius * Math.sin(rad)

        const status = statusStyles[item.status]
        const isSelected = selectedIndex === index

        return (
          <div
            key={item.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 transition-transform duration-100 ease-linear"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleNodeClick(index)
              }}
              className={cn(
                'flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border transition-all duration-300 cursor-pointer',
                'hover:scale-110 hover:bg-brand/10',
                status.ring,
                status.bg,
                isSelected && 'scale-125 bg-brand/10 shadow-lg shadow-brand/10'
              )}
              aria-label={item.title}
            >
              <span
                className={cn(
                  '[&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-5 sm:[&>svg]:w-5',
                  status.icon
                )}
              >
                {item.icon}
              </span>
            </button>

            {/* Always-visible label */}
            <span
              className={cn(
                'whitespace-nowrap text-[10px] sm:text-xs font-medium transition-opacity duration-300',
                isSelected ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {item.title}
            </span>
          </div>
        )
      })}
    </div>
  )
}
