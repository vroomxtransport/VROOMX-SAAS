'use client'

import { useAutoSyncSamsara } from '@/hooks/use-auto-sync-samsara'

/**
 * Client component that mounts the Samsara auto-sync hook.
 * Place inside QueryProvider in the dashboard layout.
 * Renders nothing — purely a side-effect component.
 */
export function SamsaraSyncProvider() {
  useAutoSyncSamsara()
  return null
}
