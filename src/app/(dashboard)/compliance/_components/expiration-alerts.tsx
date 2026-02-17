'use client'

import { useExpirationAlerts } from '@/hooks/use-compliance'
import { AlertTriangle } from 'lucide-react'

export function ExpirationAlerts() {
  const { data: alerts } = useExpirationAlerts()

  if (!alerts || alerts.length === 0) return null

  const now = new Date()
  const expired = alerts.filter((doc) => new Date(doc.expires_at!) <= now)
  const expiringSoon = alerts.filter((doc) => new Date(doc.expires_at!) > now)

  return (
    <div className="space-y-3">
      {expired.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <span>
            <strong>{expired.length}</strong> document{expired.length !== 1 ? 's' : ''} expired and require{expired.length === 1 ? 's' : ''} immediate attention.
          </span>
        </div>
      )}
      {expiringSoon.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <span>
            <strong>{expiringSoon.length}</strong> document{expiringSoon.length !== 1 ? 's' : ''} expiring within 30 days.
          </span>
        </div>
      )}
    </div>
  )
}
