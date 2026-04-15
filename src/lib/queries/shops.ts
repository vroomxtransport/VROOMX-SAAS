import type { SupabaseClient } from '@supabase/supabase-js'
import type { Shop } from '@/types/database'

export interface ShopFilters {
  includeArchived?: boolean
  kind?: 'internal' | 'external'
}

export async function fetchShops(
  supabase: SupabaseClient,
  filters: ShopFilters = {},
): Promise<Shop[]> {
  let query = supabase
    .from('shops')
    .select('*')
    .order('is_active', { ascending: false })
    .order('name', { ascending: true })

  if (!filters.includeArchived) {
    query = query.eq('is_active', true)
  }
  if (filters.kind) {
    query = query.eq('kind', filters.kind)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Shop[]
}

export async function fetchShop(
  supabase: SupabaseClient,
  id: string,
): Promise<Shop | null> {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as Shop | null) ?? null
}
