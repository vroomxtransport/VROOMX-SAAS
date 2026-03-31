import type { SupabaseClient } from '@supabase/supabase-js'
import type { Terminal } from '@/types/database'

export async function fetchTerminals(
  supabase: SupabaseClient,
  opts: { activeOnly?: boolean } = {}
): Promise<Terminal[]> {
  let query = supabase
    .from('terminals')
    .select('*')
    .order('name', { ascending: true })

  if (opts.activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) throw error
  return (data ?? []) as Terminal[]
}

export async function fetchTerminal(
  supabase: SupabaseClient,
  id: string
): Promise<Terminal> {
  const { data, error } = await supabase
    .from('terminals')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as Terminal
}
