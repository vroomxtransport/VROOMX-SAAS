'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function dismissOnboarding() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) return { error: 'No tenant found' }

  const { error } = await supabase
    .from('tenants')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', tenantId)

  if (error) {
    console.error('Failed to dismiss onboarding:', error)
    return { error: 'Failed to dismiss onboarding' }
  }

  revalidatePath('/dashboard')
  return { success: true }
}
