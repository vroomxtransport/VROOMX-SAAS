'use client'

import { useState } from 'react'
import { X, CheckCircle } from 'lucide-react'

export function SetupCompleteBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-green-900">
              Subscription setup complete!
            </h3>
            <p className="mt-1 text-sm text-green-700">
              Your payment method has been added. Your 14-day free trial has started.
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="rounded-md p-1 hover:bg-green-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4 text-green-600" />
        </button>
      </div>
    </div>
  )
}
