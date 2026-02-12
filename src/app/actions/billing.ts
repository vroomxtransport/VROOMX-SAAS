'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createPortalSession } from '@/lib/stripe/billing-portal'

/**
 * Creates a Stripe Billing Portal session and redirects the user.
 * Used from Settings page "Manage Subscription" button.
 */
export async function createBillingPortalSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) {
    return { error: 'No tenant found' }
  }

  // Fetch stripe_customer_id from tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('stripe_customer_id')
    .eq('id', tenantId)
    .single()

  if (!tenant?.stripe_customer_id) {
    return { error: 'No billing account found. Please contact support.' }
  }

  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings`

  try {
    const portalUrl = await createPortalSession(tenant.stripe_customer_id, returnUrl)
    redirect(portalUrl)
  } catch (error) {
    // redirect() throws a special error that must be re-thrown
    if ((error as any)?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error
    }
    console.error('Failed to create billing portal session:', error)
    return { error: 'Failed to open billing portal. Please try again.' }
  }
}
