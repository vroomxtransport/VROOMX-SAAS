'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Fuel } from 'lucide-react'
import { getFuelCardStatus } from '@/app/actions/fuelcard'
import { FuelCardConnectForm } from './_components/fuel-card-connect-form'
import { FuelCardDashboard } from './_components/fuel-card-dashboard'

export default function FuelCardIntegrationPage() {
  const queryClient = useQueryClient()
  const supabase = createClient()
  // React-stable per-mount channel id — prevents cross-tab and cross-tenant
  // realtime channel-name collisions.
  const channelId = useId()

  const statusQuery = useQuery({
    queryKey: ['fuel-card-status'],
    queryFn: async () => {
      const result = await getFuelCardStatus()
      if ('error' in result) throw new Error(result.error)
      return result.data
    },
    staleTime: 30_000,
  })

  // Realtime: re-fetch status when fuelcard_integrations row changes
  useEffect(() => {
    const channel = supabase
      .channel(`fuel-card-status-page-${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fuelcard_integrations' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fuel-card-status'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, queryClient, channelId])

  const isLoading = statusQuery.isLoading
  const status = statusQuery.data

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10">
          <Fuel className="h-4.5 w-4.5 text-brand" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Fuel Card Integration</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Connect your Multi Service Fuel Card to automatically import, match, and analyze fuel transactions across your fleet.
          </p>
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="widget-card">
          <div className="widget-header">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
          <div className="space-y-3">
            <div className="h-10 animate-pulse rounded-md bg-muted/50" />
            <div className="h-10 animate-pulse rounded-md bg-muted/50" />
          </div>
        </div>
      )}

      {/* Error state */}
      {statusQuery.isError && !isLoading && (
        <div className="widget-card">
          <p className="text-sm text-muted-foreground">
            Failed to load integration status. Please refresh the page.
          </p>
        </div>
      )}

      {/* Disconnected — show connect form */}
      {!isLoading && status && !status.connected && (
        <FuelCardConnectForm
          onConnected={() => {
            queryClient.invalidateQueries({ queryKey: ['fuel-card-status'] })
          }}
        />
      )}

      {/* Connected — show dashboard */}
      {!isLoading && status && status.connected && (
        <FuelCardDashboard
          status={status}
          onDisconnected={() => {
            queryClient.invalidateQueries({ queryKey: ['fuel-card-status'] })
          }}
        />
      )}
    </div>
  )
}
