'use client'

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { syncLocations, triggerFullSync } from '@/app/actions/samsara'
import { captureAsyncError } from '@/lib/async-safe'

const LOCATION_SYNC_INTERVAL = 60_000    // 60 seconds
const FULL_SYNC_INTERVAL = 5 * 60_000    // 5 minutes

/**
 * Auto-syncs Samsara data in the background while the component is mounted.
 * - Syncs GPS locations every 60 seconds
 * - Runs a full sync (vehicles, drivers, HOS, safety) every 5 minutes
 * - Only activates if the tenant has an active Samsara integration
 * - Deduplicates: skips if a sync is already in progress
 * - Silent failures (fire-and-forget)
 */
export function useAutoSyncSamsara() {
  const supabase = createClient()
  const locationSyncingRef = useRef(false)
  const fullSyncingRef = useRef(false)

  // Check if tenant has an active Samsara integration
  const { data: hasIntegration } = useQuery({
    queryKey: ['samsara-integration-check'],
    queryFn: async () => {
      const { data } = await supabase
        .from('samsara_integrations')
        .select('id, sync_status')
        .eq('sync_status', 'active')
        .limit(1)

      return data && data.length > 0
    },
    staleTime: 5 * 60_000, // Cache for 5 minutes
  })

  useEffect(() => {
    if (!hasIntegration) return

    // Location sync every 60s
    const locationInterval = setInterval(async () => {
      if (locationSyncingRef.current) return
      locationSyncingRef.current = true
      try {
        await syncLocations()
      } catch {
        // Silent failure
      } finally {
        locationSyncingRef.current = false
      }
    }, LOCATION_SYNC_INTERVAL)

    // Full sync every 5 minutes
    const fullSyncInterval = setInterval(async () => {
      if (fullSyncingRef.current) return
      fullSyncingRef.current = true
      try {
        await triggerFullSync()
      } catch {
        // Silent failure
      } finally {
        fullSyncingRef.current = false
      }
    }, FULL_SYNC_INTERVAL)

    // Initial location sync on mount
    void syncLocations().catch(captureAsyncError('auto-sync-samsara'))

    return () => {
      clearInterval(locationInterval)
      clearInterval(fullSyncInterval)
    }
  }, [hasIntegration])
}
