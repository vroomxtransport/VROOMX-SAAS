'use server'

import { z } from 'zod'
import { authorize, safeError } from '@/lib/authz'
import { sanitizeSearch } from '@/lib/sanitize-search'

const searchSchema = z.object({
  query: z.string().min(2, 'Search query too short').max(100),
  category: z.enum(['all', 'orders', 'drivers', 'trucks', 'trips']).default('all'),
})

export interface SearchResult {
  id: string
  title: string
  subtitle: string
  category: 'orders' | 'drivers' | 'trucks' | 'trips'
  href: string
}

export interface SearchResults {
  orders: SearchResult[]
  drivers: SearchResult[]
  trucks: SearchResult[]
  trips: SearchResult[]
}

export async function globalSearch(data: unknown) {
  const parsed = searchSchema.safeParse(data)
  if (!parsed.success) return { error: 'Invalid search query' }

  const auth = await authorize('*')
  if (!auth.ok) return { error: auth.error }
  const { supabase } = auth.ctx

  const sanitized = sanitizeSearch(parsed.data.query)
  if (!sanitized) return { error: 'Invalid search query' }

  const pattern = `%${sanitized}%`
  const category = parsed.data.category

  try {
    const results: SearchResults = {
      orders: [],
      drivers: [],
      trucks: [],
      trips: [],
    }

    const queries = []

    if (category === 'all' || category === 'orders') {
      queries.push(
        supabase
          .from('orders')
          .select('id, vehicle_make, vehicle_model, vehicle_vin, vehicle_year, pickup_city, delivery_city, status')
          .or(`vehicle_make.ilike.${pattern},vehicle_model.ilike.${pattern},vehicle_vin.ilike.${pattern},pickup_city.ilike.${pattern},delivery_city.ilike.${pattern}`)
          .limit(5)
          .then(({ data, error }) => {
            if (error) throw error
            results.orders = (data ?? []).map((o) => ({
              id: o.id,
              title: `${o.vehicle_year ?? ''} ${o.vehicle_make ?? ''} ${o.vehicle_model ?? ''}`.trim() || 'Unknown Vehicle',
              subtitle: `${o.pickup_city ?? ''} → ${o.delivery_city ?? ''} · ${o.status}`,
              category: 'orders' as const,
              href: `/orders/${o.id}`,
            }))
          })
      )
    }

    if (category === 'all' || category === 'drivers') {
      queries.push(
        supabase
          .from('drivers')
          .select('id, first_name, last_name, email, driver_status')
          .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`)
          .limit(5)
          .then(({ data, error }) => {
            if (error) throw error
            results.drivers = (data ?? []).map((d) => ({
              id: d.id,
              title: `${d.first_name} ${d.last_name}`,
              subtitle: `${d.email ?? 'No email'} · ${d.driver_status}`,
              category: 'drivers' as const,
              href: `/drivers/${d.id}`,
            }))
          })
      )
    }

    if (category === 'all' || category === 'trucks') {
      queries.push(
        supabase
          .from('trucks')
          .select('id, unit_number, make, model, vin, truck_status')
          .or(`unit_number.ilike.${pattern},make.ilike.${pattern},model.ilike.${pattern},vin.ilike.${pattern}`)
          .limit(5)
          .then(({ data, error }) => {
            if (error) throw error
            results.trucks = (data ?? []).map((t) => ({
              id: t.id,
              title: `#${t.unit_number}${t.make ? ` - ${t.make} ${t.model ?? ''}` : ''}`.trim(),
              subtitle: `${t.vin ?? 'No VIN'} · ${t.truck_status}`,
              category: 'trucks' as const,
              href: `/trucks/${t.id}`,
            }))
          })
      )
    }

    if (category === 'all' || category === 'trips') {
      queries.push(
        supabase
          .from('trips')
          .select('id, trip_number, status, origin_summary, destination_summary')
          .or(`trip_number.ilike.${pattern},origin_summary.ilike.${pattern},destination_summary.ilike.${pattern}`)
          .limit(5)
          .then(({ data, error }) => {
            if (error) throw error
            results.trips = (data ?? []).map((t) => ({
              id: t.id,
              title: t.trip_number ?? 'Unnamed Trip',
              subtitle: `${t.origin_summary ?? ''} → ${t.destination_summary ?? ''} · ${t.status}`,
              category: 'trips' as const,
              href: `/trips/${t.id}`,
            }))
          })
      )
    }

    await Promise.all(queries)
    return { success: true, data: results }
  } catch (err) {
    return { error: safeError(err as { message: string }, 'globalSearch') }
  }
}
