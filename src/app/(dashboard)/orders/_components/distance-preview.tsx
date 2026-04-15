'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { Loader2, MapPin, AlertCircle, Route } from 'lucide-react'
import type { CreateOrderInput } from '@/lib/validations/order'
import { previewOrderDistance } from '@/app/actions/order-distance'
import { formatMiles, formatPerMile } from '@/lib/order-metrics'

interface CachedPreview {
  pickupKey: string
  deliveryKey: string
  miles: number
  durationMinutes: number
}

const DEBOUNCE_MS = 500

function addressKey(
  location: string | null | undefined,
  city: string | null | undefined,
  state: string | null | undefined,
  zip: string | null | undefined,
): string {
  return [location, city, state, zip].map((v) => v?.trim() ?? '').join('|').toLowerCase()
}

/**
 * Live distance + RPM preview for the create-order form.
 *
 * Fires `previewOrderDistance` after the user finishes typing pickup +
 * delivery addresses (debounced 500ms). Caches the geocoded result by
 * address key so changing revenue re-computes RPM client-side without
 * hammering Mapbox. Rendered inline under the driver-pay preview in
 * pricing-step.tsx.
 */
export function DistancePreview() {
  const form = useFormContext<CreateOrderInput>()

  const pickupLocation = form.watch('pickupLocation')
  const pickupCity = form.watch('pickupCity')
  const pickupState = form.watch('pickupState')
  const pickupZip = form.watch('pickupZip')
  const deliveryLocation = form.watch('deliveryLocation')
  const deliveryCity = form.watch('deliveryCity')
  const deliveryState = form.watch('deliveryState')
  const deliveryZip = form.watch('deliveryZip')
  const revenue = form.watch('revenue')
  const brokerFee = form.watch('brokerFee')
  const localFee = form.watch('localFee')

  const pickupKey = useMemo(
    () => addressKey(pickupLocation, pickupCity, pickupState, pickupZip),
    [pickupLocation, pickupCity, pickupState, pickupZip],
  )
  const deliveryKey = useMemo(
    () => addressKey(deliveryLocation, deliveryCity, deliveryState, deliveryZip),
    [deliveryLocation, deliveryCity, deliveryState, deliveryZip],
  )

  const hasEnoughForPickup = Boolean(pickupCity && pickupState && pickupState.length === 2)
  const hasEnoughForDelivery = Boolean(deliveryCity && deliveryState && deliveryState.length === 2)
  const canPreview = hasEnoughForPickup && hasEnoughForDelivery

  const [cache, setCache] = useState<CachedPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track the latest request so a late-arriving response from a stale
  // address combo doesn't clobber the current one.
  const latestKeyRef = useRef('')

  useEffect(() => {
    if (!canPreview) {
      setCache(null)
      setError(null)
      setLoading(false)
      return
    }

    // If the address key already matches what's cached, skip the
    // network call — revenue changes alone don't need a re-geocode.
    if (cache && cache.pickupKey === pickupKey && cache.deliveryKey === deliveryKey) {
      return
    }

    const combinedKey = `${pickupKey}::${deliveryKey}`
    latestKeyRef.current = combinedKey

    const handle = setTimeout(async () => {
      setLoading(true)
      setError(null)
      const result = await previewOrderDistance({
        pickupLocation: pickupLocation || null,
        pickupCity: pickupCity || '',
        pickupState: pickupState || '',
        pickupZip: pickupZip || null,
        deliveryLocation: deliveryLocation || null,
        deliveryCity: deliveryCity || '',
        deliveryState: deliveryState || '',
        deliveryZip: deliveryZip || null,
        revenue: revenue ? Number(revenue) : null,
        brokerFee: brokerFee ? Number(brokerFee) : null,
        localFee: localFee ? Number(localFee) : null,
      })

      // Ignore stale response if another address change fired while we
      // were awaiting this one.
      if (latestKeyRef.current !== combinedKey) return

      if ('error' in result) {
        setError(result.error)
        setCache(null)
      } else {
        setCache({
          pickupKey,
          deliveryKey,
          miles: result.miles,
          durationMinutes: result.durationMinutes,
        })
        // Auto-populate the distanceMiles form field only when the user
        // hasn't manually typed a value. Dispatchers occasionally know
        // truck-routed mileage that Mapbox doesn't — don't stomp that.
        const current = form.getValues('distanceMiles')
        if (!current || current === 0) {
          form.setValue('distanceMiles', result.miles, { shouldDirty: false })
        }
      }
      setLoading(false)
    }, DEBOUNCE_MS)

    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- form is stable from context
  }, [canPreview, pickupKey, deliveryKey])

  // Clean Gross per mile — matches computeRevenuePerMile(). Revenue,
  // brokerFee, and localFee all flow into this so the preview stays in
  // sync as the user types any of the three. No re-geocode needed: the
  // cached distance is still valid as long as the addresses didn't change.
  const revenuePerMile = useMemo(() => {
    if (!cache || cache.miles <= 0) return null
    const rev = Number(revenue) || 0
    const bf = Number(brokerFee) || 0
    const lf = Number(localFee) || 0
    const cleanGross = rev - bf - lf
    if (cleanGross <= 0) return null
    return Math.round((cleanGross / cache.miles) * 100) / 100
  }, [cache, revenue, brokerFee, localFee])

  if (!canPreview) {
    return (
      <div className="rounded-md border border-dashed border-border-subtle bg-muted/30 p-3 text-xs text-muted-foreground">
        <MapPin className="mr-1.5 inline h-3 w-3" />
        Fill in pickup and delivery city + state to auto-calculate mileage and RPM.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-md border border-border-subtle bg-accent/30 p-3 text-xs text-muted-foreground">
        <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />
        Calculating mileage…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
        <AlertCircle className="mr-1.5 inline h-3 w-3" />
        {error}
      </div>
    )
  }

  if (!cache) return null

  return (
    <div className="rounded-md border border-border-subtle bg-accent/30 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Route className="h-3.5 w-3.5" />
          Auto-calculated route
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Distance
          </div>
          <div className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
            {formatMiles(cache.miles)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Drive time
          </div>
          <div className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
            {Math.floor(cache.durationMinutes / 60)}h {cache.durationMinutes % 60}m
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Revenue / mi
          </div>
          <div className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
            {formatPerMile(revenuePerMile)}
          </div>
        </div>
      </div>
    </div>
  )
}
