import type { SupabaseClient } from '@supabase/supabase-js'

export interface Dispatcher {
  id: string
  user_id: string
  role: string
  email: string
  full_name: string
  created_at: string
}

export async function fetchDispatchers(supabase: SupabaseClient): Promise<Dispatcher[]> {
  const { data, error } = await supabase
    .from('tenant_memberships')
    .select('*')
    .in('role', ['owner', 'admin', 'dispatcher'])
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((m: Record<string, unknown>) => ({
    id: m.id as string,
    user_id: m.user_id as string,
    role: m.role as string,
    email: (m.email as string) ?? '',
    full_name: (m.full_name as string) ?? '',
    created_at: m.created_at as string,
  }))
}
