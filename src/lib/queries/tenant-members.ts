import type { SupabaseClient } from '@supabase/supabase-js'

export interface TenantMember {
  userId: string
  fullName: string
  email: string
}

export async function fetchTenantMembers(supabase: SupabaseClient): Promise<TenantMember[]> {
  const { data, error } = await supabase
    .from('tenant_memberships')
    .select('user_id, full_name, email')
    .order('full_name', { ascending: true, nullsFirst: false })

  if (error) throw error

  return (data ?? []).map((m: Record<string, unknown>) => ({
    userId: m.user_id as string,
    fullName: (m.full_name as string) ?? '',
    email: (m.email as string) ?? '',
  }))
}
