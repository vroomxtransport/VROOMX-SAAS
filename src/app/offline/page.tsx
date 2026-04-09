'use client'

import { WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-content-bg px-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-md">
            <span className="text-2xl font-bold text-primary-foreground tracking-tight">
              V
            </span>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-8 shadow-md text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <WifiOff className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>

          <h1 className="mb-2 text-xl font-semibold text-foreground">
            You&apos;re offline
          </h1>
          <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
            Check your connection and try again. Any changes you make will sync
            when you&apos;re back online.
          </p>

          <Button
            className="w-full"
            onClick={() => window.location.reload()}
          >
            Try Again
          </Button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          VroomX TMS &mdash; Transportation Management System
        </p>
      </div>
    </div>
  )
}
