import type { SupabaseClient } from '@supabase/supabase-js'
import type { Trailer } from '@/types/database'

export interface TrailerFilters {
  status?: string
  search?: string
}

export interface TrailersResult {
  trailers: Trailer[]
  total: number
}

export async function fetchTrailers(
  supabase: SupabaseClient,
  filters: TrailerFilters = {}
): Promise<TrailersResult> {
  const { status, search } = filters

  let query = supabase
    .from('trailers')
    .select('*', { count: 'exact' })
    .order('trailer_number', { ascending: true })

  if (status) {
    query = query.eq('status', status)
  }

  if (search) {
    query = query.or(
      `trailer_number.ilike.%${search}%,make.ilike.%${search}%,model.ilike.%${search}%`
    )
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    trailers: (data ?? []) as Trailer[],
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
