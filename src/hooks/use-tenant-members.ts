'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { fetchTenantMembers } from '@/lib/queries/tenant-members'

export function useTenantMembers() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['tenant-members'],
    queryFn: () => fetchTenantMembers(supabase),
    staleTime: 5 * 60 * 1000,
  })
}
