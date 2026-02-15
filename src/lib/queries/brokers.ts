import type { SupabaseClient } from '@supabase/supabase-js'
import type { Broker } from '@/types/database'
import { sanitizeSearch } from '@/lib/sanitize-search'

export interface BrokerFilters {
  search?: string
  page?: number
  pageSize?: number
}

export interface BrokersResult {
  brokers: Broker[]
  total: number
}

export async function fetchBrokers(
  supabase: SupabaseClient,
  filters: BrokerFilters = {}
): Promise<BrokersResult> {
  const { search, page = 0, pageSize = 20 } = filters

  let query = supabase
    .from('brokers')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  if (search) {
    const s = sanitizeSearch(search)
    if (s) {
      query = query.ilike('name', `%${s}%`)
    }
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    brokers: (data ?? []) as Broker[],
    total: count ?? 0,
  }
}

export async function fetchBroker(
  supabase: SupabaseClient,
  id: string
): Promise<Broker> {
  const { data, error } = await supabase
    .from('brokers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  return data as Broker
}
