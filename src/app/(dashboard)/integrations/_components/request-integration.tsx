'use client'

import { Lightbulb, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function RequestIntegration() {
  return (
    <div className="animate-fade-up rounded-2xl border-2 border-dashed border-border-subtle bg-gradient-to-br from-surface via-background to-surface-raised p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50">
        <Lightbulb className="h-6 w-6 text-amber-600" />
      </div>

      <h3 className="text-base font-semibold text-foreground">
        Don&apos;t see what you need?
      </h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
        Let us know which integration would help your fleet operations.
        We prioritize based on customer demand.
      </p>

      <Button
        variant="outline"
        className="mt-5 gap-2"
        onClick={() => {
          window.location.href =
            'mailto:integrations@vroomx.com?subject=Integration%20Request'
        }}
      >
        Request Integration
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
