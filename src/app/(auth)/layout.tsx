import Image from 'next/image'
import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — logo (hidden on mobile) */}
      <div className="relative hidden w-1/2 overflow-hidden bg-background lg:flex lg:items-center lg:justify-center">
        <Image
          src="/images/logo-white.png"
          alt="VroomX TMS"
          width={616}
          height={211}
          priority
          className="pointer-events-none w-[60%] max-w-[360px] h-auto brightness-0"
        />
      </div>

      {/* Right panel — form */}
      <div className="relative flex w-full flex-col items-center justify-center bg-surface px-6 lg:w-1/2 lg:border-l lg:border-border-subtle lg:shadow-[−8px_0_30px_rgba(0,0,0,0.04)]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/[0.02] via-transparent to-[#2a3a4f]/[0.02]" />
        <div className="relative w-full max-w-md py-12">
          {children}
        </div>
      </div>
    </div>
  )
}
