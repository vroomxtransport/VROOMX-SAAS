'use client'

import Image from 'next/image'
import { Ripple, TechOrbitDisplay } from '@/components/blocks/modern-animated-sign-in'
import {
  Truck, Package, MapPin, CreditCard,
  FileCheck, Shield, Smartphone, BarChart3, Navigation,
} from 'lucide-react'
import type { ReactNode } from 'react'

const vroomxIcons = [
  {
    component: () => <Truck className="h-5 w-5 text-brand" />,
    className: 'size-[30px] border-none bg-brand/10',
    duration: 20, delay: 20, radius: 100, path: false, reverse: false,
  },
  {
    component: () => <Package className="h-5 w-5 text-brand" />,
    className: 'size-[30px] border-none bg-brand/10',
    duration: 20, delay: 10, radius: 100, path: false, reverse: false,
  },
  {
    component: () => <CreditCard className="h-6 w-6 text-brand" />,
    className: 'size-[50px] border-none bg-brand/5',
    radius: 210, duration: 20, path: false, reverse: false,
  },
  {
    component: () => <Shield className="h-6 w-6 text-brand" />,
    className: 'size-[50px] border-none bg-brand/5',
    radius: 210, duration: 20, delay: 20, path: false, reverse: false,
  },
  {
    component: () => <MapPin className="h-5 w-5 text-brand" />,
    className: 'size-[30px] border-none bg-brand/10',
    duration: 20, delay: 20, radius: 150, path: false, reverse: true,
  },
  {
    component: () => <FileCheck className="h-5 w-5 text-brand" />,
    className: 'size-[30px] border-none bg-brand/10',
    duration: 20, delay: 10, radius: 150, path: false, reverse: true,
  },
  {
    component: () => <Smartphone className="h-6 w-6 text-brand" />,
    className: 'size-[50px] border-none bg-brand/5',
    radius: 270, duration: 20, path: false, reverse: true,
  },
  {
    component: () => <BarChart3 className="h-6 w-6 text-brand" />,
    className: 'size-[50px] border-none bg-brand/5',
    radius: 270, duration: 20, delay: 60, path: false, reverse: true,
  },
  {
    component: () => <Navigation className="h-6 w-6 text-brand" />,
    className: 'size-[50px] border-none bg-brand/5',
    radius: 320, duration: 20, delay: 20, path: false, reverse: false,
  },
]

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — animated orbit display (hidden on mobile) */}
      <div className="relative hidden w-1/2 overflow-hidden bg-background lg:flex lg:flex-col lg:items-center lg:justify-center">
        <Ripple mainCircleSize={100} />
        <TechOrbitDisplay iconsArray={vroomxIcons}>
          <Image
            src="/images/logo-white.png"
            alt="VroomX TMS"
            width={280}
            height={96}
            className="pointer-events-none h-20 w-auto brightness-0"
          />
        </TechOrbitDisplay>
      </div>

      {/* Right panel — form (elevated surface with subtle border + shadow) */}
      <div className="relative flex w-full flex-col items-center justify-center bg-surface px-6 lg:w-1/2 lg:border-l lg:border-border-subtle lg:shadow-[−8px_0_30px_rgba(0,0,0,0.04)]">
        {/* Subtle top-to-bottom gradient overlay for depth */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/[0.02] via-transparent to-amber-500/[0.02]" />
        <div className="relative w-full max-w-md py-12">
          {children}
        </div>
      </div>
    </div>
  )
}
