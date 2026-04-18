'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { authorize, safeError } from '@/lib/authz'
import { recomputeTripRouteGeometry } from '@/lib/trip-routing'
import { recalculateTripFinancials } from '@/app/actions/trips'

const recalculateTripRouteSchema = z.object({
  tripId: z.string().uuid(),
})

/**
 * Manually re-run Mapbox Directions for a trip, regenerating its
 * cached `route_geometry`, `route_distance_meters`, and
 * `route_duration_seconds`, then triggering a financials recompute so
 * `total_miles` reflects the new road distance.
 *
 * Surfaced as the `RecalculateTripRouteButton` on the trip detail
 * page. Auto-recompute on sequence change is handled by
 * `updateRouteSequence`; this manual entry point covers legacy trips
 * (no geometry yet) and Mapbox-failure recovery cases.
 *
 * Returns one of:
 * - `{ success: true, miles, status: 'ok' }` — geometry persisted.
 * - `{ success: true, miles: null, status: 'ok' | 'failed' | 'skipped', error?: string }`
 *   — Mapbox skip/fail. UI surfaces the reason as an info toast.
 * - `{ error: string }` — auth/validation failure. UI surfaces as
 *   destructive toast.
 */
export async function recalculateTripRoute(input: unknown): Promise<
  | {
      success: true
      status: 'ok' | 'failed' | 'skipped'
      miles: number | null
      error?: string | null
    }
  | { error: string }
> {
  const parsed = recalculateTripRouteSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Invalid input' }
  }

  const auth = await authorize('trips.update', {
    rateLimit: { key: 'tripRouteRecalc', limit: 10, windowMs: 60_000 },
  })
  if (!auth.ok) {
    return { error: auth.error }
  }
  const { supabase, tenantId } = auth.ctx
  const { tripId } = parsed.data

  // Defense-in-depth: confirm the trip belongs to this tenant before
  // we touch the helper. The helper also tenant-scopes its own
  // queries; this just gives the caller a clean 404 path.
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('tenant_id', tenantId)
    .single()
  if (tripError || !trip) {
    return { error: 'Trip not found' }
  }

  try {
    const outcome = await recomputeTripRouteGeometry(supabase, tripId, tenantId)

    // Re-derive denormalized financials from the new
    // `route_distance_meters` so per-mile driver pay is correct.
    // recalculateTripFinancials handles its own CAS retries; we don't
    // need to await + thread its result back to the UI — the realtime
    // subscription will deliver the updated trip row.
    if (outcome.ok) {
      const recalc = await recalculateTripFinancials(tripId)
      if ('error' in recalc && recalc.error) {
        // Don't fail the whole action — the geometry already landed,
        // and the financial recalc CAS loop occasionally hits an echo
        // race that resolves on the next tick.
        console.warn(
          `[recalculateTripRoute] financials recompute warning for trip ${tripId}: ${recalc.error}`,
        )
      }
    }

    revalidatePath(`/trips/${tripId}`)

    if (!outcome.ok) {
      return {
        success: true,
        status: outcome.reason === 'MAPBOX_FAILED' ? 'failed' : 'skipped',
        miles: null,
        error: skipReasonMessage(outcome.reason),
      }
    }

    return {
      success: true,
      status: 'ok',
      miles: outcome.meters != null ? Math.round((outcome.meters / 1609.344) * 10) / 10 : null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { error: safeError({ message }, 'recalculateTripRoute') }
  }
}

function skipReasonMessage(reason: string | undefined): string {
  switch (reason) {
    case 'MISSING_SEQUENCE':
      return 'Save a route order first, then recalculate.'
    case 'TOO_MANY_STOPS':
      return 'Trips with more than 25 stops can’t be routed in one pass yet.'
    case 'MISSING_COORDS':
      return 'One or more stops aren’t geocoded yet. Fix the addresses and retry.'
    case 'MAPBOX_FAILED':
      return 'Mapbox couldn’t produce a route through these stops.'
    default:
      return 'Could not recalculate the route.'
  }
}
