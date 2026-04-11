'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getBuiltInRolePermissions, hasPermission } from '@/lib/permissions'

/**
 * Client-side permission check for the current authenticated user.
 *
 * Reads the role from `supabase.auth.getUser().app_metadata.role` and
 * resolves it against the built-in role → permissions map. Custom roles
 * (`custom:<uuid>`) return an empty permissions array client-side — the
 * server always re-authorizes, so this is safe: it just means custom-role
 * users won't see gated UI elements they can't use anyway.
 *
 * Intended for UI-only gating (hiding buttons, disabling links).
 * **NEVER** rely on this for authorization — the server action at every
 * callsite is the actual security boundary.
 */
export function useCurrentUserPermissions() {
  const supabase = createClient()

  const query = useQuery({
    queryKey: ['current-user-permissions'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) return []
      const role = (data.user.app_metadata?.role as string | undefined) ?? ''
      // Built-in role: synchronous lookup.
      const builtIn = getBuiltInRolePermissions(role)
      if (builtIn) return builtIn
      // Custom roles require a server round-trip to resolve; UI-side
      // permission gating is best-effort, so fall through to empty. If
      // the user tries to click a gated action, the server action will
      // re-authorize and surface a clean error.
      return []
    },
    // Cache for the life of the session — the role rarely changes mid-session
    // and a stale permissions array is safe because the server re-checks.
    staleTime: 5 * 60_000,
    retry: false,
  })

  const permissions = query.data ?? []

  // Memoized helper so consumers don't recompute on every render.
  const can = useMemo(
    () => (required: string): boolean => hasPermission(permissions, required),
    [permissions],
  )

  return {
    permissions,
    can,
    isLoading: query.isLoading,
  }
}
