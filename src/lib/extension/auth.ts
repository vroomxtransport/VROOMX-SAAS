/**
 * Bearer-token Supabase client for extension API routes.
 *
 * Chrome extensions cannot send cookies cross-origin, so we authenticate
 * via Authorization header and create a Supabase client scoped to that token.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface ExtensionAuthResult {
  supabase: SupabaseClient
  userId: string
  tenantId: string
  email: string | undefined
}

/**
 * Authenticate an extension request using the bearer token.
 * Returns the authenticated Supabase client and user context, or null if auth fails.
 */
export async function authenticateExtension(
  request: Request
): Promise<ExtensionAuthResult | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) return null

  return {
    supabase,
    userId: user.id,
    tenantId,
    email: user.email,
  }
}
