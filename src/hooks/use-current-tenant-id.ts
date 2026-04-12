'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

/**
 * Session-long lookup of the current user's tenant_id from Supabase
 * `app_metadata`. Used to scope realtime subscriptions so we only
 * listen to rows that belong to this tenant — prevents cross-tenant
 * event fan-out on the realtime bus.
 *
 * Returns `null` while loading or if unauthenticated; callers that use
 * this to build a realtime filter MUST gate their `useEffect` on a
 * non-null value and re-subscribe when it resolves.
 *
 * N7: extracted from use-pnl.ts and use-chat-unread.ts to avoid
 * duplicating the same hook in every file that needs tenant-scoped
 * realtime subscriptions.
 */
export function useCurrentTenantId(): string | null {
  const supabase = createClient()
  const query = useQuery({
    queryKey: ['current-user-tenant-id'],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) return null
      const tenantId = data.user.app_metadata?.tenant_id
      return typeof tenantId === 'string' ? tenantId : null
    },
    staleTime: 5 * 60_000,
    retry: false,
  })
  return query.data ?? null
}
