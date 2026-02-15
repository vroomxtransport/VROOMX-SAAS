import type { SupabaseClient } from '@supabase/supabase-js'
import type { Trailer } from '@/types/database'
import { sanitizeSearch } from '@/lib/sanitize-search'

export interface TrailerFilters {
  status?: string
  trailerType?: string
  search?: string
  page?: number
  pageSize?: number
}

export interface TrailerWithTruck extends Trailer {
  assigned_truck: { id: string; unit_number: string } | null
}

export interface TrailersResult {
  trailers: TrailerWithTruck[]
  total: number
}

export async function fetchTrailers(
  supabase: SupabaseClient,
  filters: TrailerFilters = {}
): Promise<TrailersResult> {
  const { status, trailerType, search, page = 0, pageSize = 20 } = filters

  let query = supabase
    .from('trailers')
    .select('*, assigned_truck:trucks!trailer_id(id, unit_number)', { count: 'exact' })
    .order('trailer_number', { ascending: true })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (status) {
    query = query.eq('status', status)
  }

  if (trailerType) {
    query = query.eq('trailer_type', trailerType)
  }

  if (search) {
    const s = sanitizeSearch(search)
    if (s) {
      query = query.or(
        `trailer_number.ilike.%${s}%,make.ilike.%${s}%,model.ilike.%${s}%`
      )
    }
  }

  const { data, error, count } = await query

  if (error) throw error

  // Normalize the assigned_truck join (could be array from Supabase)
  const trailers = (data ?? []).map((t) => {
    const truck = Array.isArray(t.assigned_truck)
      ? t.assigned_truck[0] ?? null
      : t.assigned_truck ?? null
    return { ...t, assigned_truck: truck } as TrailerWithTruck
  })

  return {
    trailers,
    total: count ?? 0,
  }
}

export async function fetchTrailer(
  supabase: SupabaseClient,
  id: string
): Promise<Trailer> {
  const { data, error } = await supabase
    .from('trailers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return data as Trailer
}
