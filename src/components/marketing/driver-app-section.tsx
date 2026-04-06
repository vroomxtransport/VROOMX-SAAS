'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Camera01Icon,
  Invoice02Icon,
  MapPinIcon,
  WifiDisconnected01Icon,
} from '@hugeicons/core-free-icons'
import { TimelineContent } from '@/components/ui/timeline-animation'
import { DeviceFrame } from './device-frame'

interface DriverFeature {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any
  title: string
  description: string
}

const driverFeatures: DriverFeature[] = [
  {
    icon: Camera01Icon,
    title: 'Photo Inspections',
    description:
      'Capture vehicle condition at pickup and delivery with timestamped photos.',
  },
  {
    icon: Invoice02Icon,
    title: 'Digital BOL',
    description:
      'Generate bills of lading with e-signatures. No more paper forms.',
  },
  {
    icon: MapPinIcon,
    title: 'Real-Time Status',
    description:
      'Drivers update order status with one tap. You see it instantly.',
  },
  {
    icon: WifiDisconnected01Icon,
    title: 'Works Offline',
    description:
      'Full inspection capability without cell service. Syncs when back online.',
  },
]

export function DriverAppSection() {
  const sectionRef = useRef<HTMLElement>(null)

  return (
    <section
      ref={sectionRef}
      className="bg-background py-20 sm:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          {/* Left column - device frame */}
          <TimelineContent as="div" animationNum={0} timelineRef={sectionRef}>
            <div className="relative mx-auto max-w-[280px]">
              {/* Glow behind device */}
              <div className="absolute -inset-8 rounded-3xl bg-brand/[0.04] blur-3xl" />
              <DeviceFrame className="relative">
                <Image
                  src="/images/driver-app-inspection.png"
                  alt="VroomX Driver App - Vehicle inspection screen with photo capture"
                  width={320}
                  height={640}
                  className="h-auto w-full"
                />
              </DeviceFrame>
            </div>
          </TimelineContent>

          {/* Right column - features */}
          <div>
            <TimelineContent as="div" animationNum={0} timelineRef={sectionRef}>
              <p className="section-kicker mb-4">
                Driver Mobile App
              </p>

              <h2 className="text-3xl font-bold tracking-[-0.015em] text-foreground sm:text-4xl lg:text-[2.75rem]">
                Your drivers will actually use this one
              </h2>

              <p className="mt-4 text-lg text-muted-foreground">
                A native app built for the road,not another clunky web portal.
              </p>
            </TimelineContent>

            <div className="mt-10 space-y-6">
              {driverFeatures.map((feature, idx) => {
                return (
                  <TimelineContent
                    key={feature.title}
                    as="div"
                    animationNum={idx + 1}
                    timelineRef={sectionRef}
                  >
                    <div className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/15 bg-gradient-to-b from-brand/[0.12] to-brand/[0.04]">
                        <HugeiconsIcon icon={feature.icon} size={20} className="text-brand" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {feature.title}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </TimelineContent>
                )
              })}
            </div>

            <TimelineContent as="div" animationNum={5} timelineRef={sectionRef}>
              <p className="mt-10 text-sm text-muted-foreground">
                Works on any iPhone or Android,no special hardware needed
              </p>
            </TimelineContent>

            <TimelineContent as="div" animationNum={6} timelineRef={sectionRef}>
              <div className="mt-8">
                <a
                  href="/signup"
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-semibold text-white shadow-md transition-all hover:bg-brand/90 hover:shadow-lg"
                >
                  Try the Driver App Free
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </a>
              </div>
            </TimelineContent>
          </div>
        </div>
      </div>
    </section>
  )
}
